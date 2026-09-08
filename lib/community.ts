import { database } from '@/db';
import {
  accountFromRequest,
  digest,
  passwordHash,
  sessionToken,
} from '@/lib/auth';
import {
  assignedGroup,
  normalizeState,
  UserError,
  type Contender,
  type Row,
} from '@/lib/brackets';
export async function requireAccount(req: Request) {
  const a = await accountFromRequest(req);
  if (!a) throw new UserError('Sign in to continue.', 401);
  return a;
}
export async function isAdmin(id: string) {
  return !!(
    await database()
      .prepare('SELECT admin FROM community_accounts WHERE account_id=?')
      .bind(id)
      .first<{ admin: number }>()
  )?.admin;
}
export async function maintenance() {
  if (
    (
      await database()
        .prepare("SELECT value FROM operations WHERE key='maintenance'")
        .first<{ value: string }>()
    )?.value === '1'
  )
    throw new UserError(
      'Bracket Club is getting a fresh start. Please return shortly.',
      503,
    );
}
export function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
export function safeUrl(value: unknown) {
  if (!value) return '';
  try {
    const u = new URL(String(value));
    if (!['https:', 'http:'].includes(u.protocol)) throw 0;
    return u.href.slice(0, 2000);
  } catch {
    throw new UserError('Use a full http or https URL.');
  }
}
export function contenders(input: unknown, names: string[]): Contender[] {
  const data = Array.isArray(input) ? input : [];
  return names.map((name, index) => ({
    name,
    image: safeUrl(data[index]?.image),
    description: text(data[index]?.description, 240),
    link: safeUrl(data[index]?.link),
  }));
}
export async function accountSettings(
  req: Request,
  input: Record<string, unknown>,
) {
  const a = await requireAccount(req);
  const token = sessionToken(req);
  const current = token ? await digest(token) : '';
  if (input.action === 'sessions') {
    const result = await database()
      .prepare(
        'SELECT token_hash,expires_at FROM sessions WHERE account_id=? AND expires_at>? ORDER BY expires_at DESC',
      )
      .bind(a.id, Date.now())
      .all<{ token_hash: string; expires_at: number }>();
    return {
      sessions: result.results.map((s) => ({
        id: s.token_hash,
        expiresAt: s.expires_at,
        current: s.token_hash === current,
      })),
    };
  }
  if (input.action === 'revoke') {
    await database()
      .prepare('DELETE FROM sessions WHERE account_id=? AND token_hash=?')
      .bind(a.id, text(input.id, 64))
      .run();
    return { ok: true };
  }
  if (input.action === 'profile') {
    await database()
      .prepare(
        'INSERT INTO community_accounts (account_id,bio) VALUES (?,?) ON CONFLICT(account_id) DO UPDATE SET bio=excluded.bio',
      )
      .bind(a.id, text(input.bio, 280))
      .run();
    return { ok: true };
  }
  const row = await database()
    .prepare('SELECT password_hash,password_salt FROM accounts WHERE id=?')
    .bind(a.id)
    .first<{ password_hash: string; password_salt: string }>();
  if (
    !row ||
    (await passwordHash(String(input.password ?? ''), row.password_salt)) !==
      row.password_hash
  )
    throw new UserError('Enter your current password.', 403);
  if (input.action === 'password') {
    const next = String(input.nextPassword ?? '');
    if (next.length < 8 || next.length > 100)
      throw new UserError('Use a password between 8 and 100 characters.');
    const salt = crypto.randomUUID();
    await database().batch([
      database()
        .prepare(
          'UPDATE accounts SET password_hash=?,password_salt=? WHERE id=?',
        )
        .bind(await passwordHash(next, salt), salt, a.id),
      database()
        .prepare('DELETE FROM sessions WHERE account_id=? AND token_hash<>?')
        .bind(a.id, current),
    ]);
    return { ok: true };
  }
  if (input.action === 'delete-account') {
    const viewer = 'account:' + a.id;
    const rows = await database()
      .prepare('SELECT id FROM brackets WHERE owner=? OR instr(state,?)>0')
      .bind(viewer, viewer)
      .all<{ id: string }>();
    for (const r of rows.results)
      await transferIdentity(
        r.id,
        viewer,
        'deleted:' + crypto.randomUUID(),
        false,
      );
    await database().batch(
      [
        'sessions',
        'bracket_activity',
        'community_accounts',
        'templates',
        'notifications',
        'reports',
      ]
        .map((table) =>
          database()
            .prepare(`DELETE FROM ${table} WHERE account_id=?`)
            .bind(a.id),
        )
        .concat([
          database().prepare('DELETE FROM accounts WHERE id=?').bind(a.id),
        ]),
    );
    return { ok: true };
  }
  throw new UserError('Unknown account action.');
}
export async function transferIdentity(
  id: string,
  from: string,
  to: string,
  claim = true,
) {
  for (let i = 0; i < 6; i++) {
    const row = await database()
      .prepare('SELECT * FROM brackets WHERE id=?')
      .bind(id)
      .first<Row>();
    if (!row) return false;
    const state = normalizeState(row.state);
    const hasOld = state.rounds.some((r) =>
      r.some((m) => m.ballots[from] !== undefined),
    );
    if (!hasOld && row.owner !== from) return false;
    if (
      claim &&
      state.rounds.some((r) => r.some((m) => m.ballots[to] !== undefined))
    )
      return false;
    state.groups = {
      ...state.groups,
      [to]: state.groups?.[from] ?? assignedGroup(from, id),
    };
    delete state.groups[from];
    for (const round of state.rounds)
      for (const match of round) {
        if (match.ballots[from] !== undefined) {
          match.ballots[to] = match.ballots[from];
          delete match.ballots[from];
        }
      }
    const result = await database()
      .prepare(
        'UPDATE brackets SET owner=?,state=?,version=version+1 WHERE id=? AND version=?',
      )
      .bind(
        row.owner === from ? to : row.owner,
        JSON.stringify(state),
        id,
        row.version,
      )
      .run();
    if (result.meta.changes === 1) {
      await database()
        .prepare(
          'UPDATE OR REPLACE participation SET id=?,viewer=? WHERE bracket_id=? AND viewer=?',
        )
        .bind(id + ':' + to, to, id, from)
        .run();
      if (claim)
        await database()
          .prepare(
            'INSERT INTO bracket_activity (bracket_id,account_id,kind,updated_at) VALUES (?,?,?,?) ON CONFLICT(bracket_id,account_id,kind) DO UPDATE SET updated_at=excluded.updated_at',
          )
          .bind(
            id,
            to.slice(8),
            row.owner === from ? 'created' : 'voted',
            Date.now(),
          )
          .run();
      return true;
    }
  }
  throw new UserError('Votes changed while claiming. Please try again.', 409);
}
