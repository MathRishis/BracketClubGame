import { database } from '@/db';
import {
  body,
  failure,
  reply,
  UserError,
  normalizeState,
  summary,
  read,
  type Row,
} from '@/lib/brackets';
import {
  accountSettings,
  requireAccount,
  isAdmin,
  text,
  contenders,
  maintenance,
  transferIdentity,
} from '@/lib/community';
import { digest, accountFromRequest } from '@/lib/auth';
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const profile = url.searchParams.get('profile');
    if (profile) {
      const a = await database()
        .prepare(
          'SELECT a.id,a.username,a.display_name,c.bio FROM accounts a LEFT JOIN community_accounts c ON c.account_id=a.id WHERE a.id=?',
        )
        .bind(profile)
        .first();
      if (!a) throw new UserError('Creator not found.', 404);
      const rows = await database()
        .prepare(
          "SELECT * FROM brackets WHERE owner=? AND json_extract(state,'$.moderation')='approved' AND json_extract(state,'$.settings.visibility')='worldwide'",
        )
        .bind('account:' + profile)
        .all<Row>();
      return reply({
        profile: a,
        brackets: rows.results.map((r) => summary(r, '')),
      });
    }
    const a = await requireAccount(req);
    const admin = await isAdmin(a.id);
    const [kits, inbox, profileRow] = await Promise.all([
      database()
        .prepare(
          'SELECT * FROM templates WHERE account_id=? ORDER BY created_at DESC',
        )
        .bind(a.id)
        .all(),
      database()
        .prepare(
          'SELECT * FROM notifications WHERE account_id=? ORDER BY created_at DESC LIMIT 100',
        )
        .bind(a.id)
        .all(),
      database()
        .prepare('SELECT bio FROM community_accounts WHERE account_id=?')
        .bind(a.id)
        .first(),
    ]);
    let review: unknown[] = [];
    let reports: unknown[] = [];
    if (admin) {
      review = (
        await database()
          .prepare(
            "SELECT * FROM brackets WHERE json_extract(state,'$.settings.visibility')='worldwide' ORDER BY created_at DESC LIMIT 100",
          )
          .all<Row>()
      ).results.map((r) => summary(r, 'account:' + a.id));
      reports = (
        await database()
          .prepare(
            'SELECT * FROM reports WHERE resolved=0 ORDER BY created_at DESC LIMIT 100',
          )
          .all()
      ).results;
    }
    return reply({
      admin,
      templates: kits.results,
      notifications: inbox.results,
      profile: profileRow,
      review,
      reports,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await maintenance();
    const input = await body(req);
    const a = await requireAccount(req);
    const viewer = 'account:' + a.id;
    if (
      ['sessions', 'revoke', 'password', 'delete-account', 'profile'].includes(
        input.action,
      )
    )
      return reply(await accountSettings(req, input));
    if (input.action === 'seen') {
      await database()
        .prepare('UPDATE notifications SET seen=1 WHERE account_id=?')
        .bind(a.id)
        .run();
      return reply({ ok: true });
    }
    if (input.action === 'claim') {
      const token = req.headers
        .get('cookie')
        ?.split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('bc_player='))
        ?.slice(10);
      if (!token || !/^[0-9a-f-]{36}$/.test(token))
        return reply({ claimed: 0, skipped: 0 });
      const from = await digest(token);
      const rows = await database()
        .prepare('SELECT id FROM brackets WHERE owner=? OR instr(state,?)>0')
        .bind(from, from)
        .all<{ id: string }>();
      let claimed = 0;
      for (const r of rows.results)
        if (await transferIdentity(r.id, from, viewer)) claimed++;
      return reply({ claimed, skipped: rows.results.length - claimed });
    }
    if (input.action === 'save-template') {
      const names = input.entries;
      if (
        !Array.isArray(names) ||
        ![4, 8, 16, 32].includes(names.length) ||
        names.some(
          (n) => typeof n !== 'string' || !n.trim() || n.length > 60,
        ) ||
        new Set(names.map((n) => n.trim().toLowerCase())).size !== names.length
      )
        throw new UserError('Use 4, 8, 16, or 32 unique contender names.');
      const title = text(input.title, 80);
      if (!title) throw new UserError('Add a template title.');
      await database()
        .prepare(
          'INSERT INTO templates (id,account_id,title,data,created_at) VALUES (?,?,?,?,?)',
        )
        .bind(
          crypto.randomUUID(),
          a.id,
          title,
          JSON.stringify({
            title,
            description: text(input.description, 200),
            entries: names,
            contenders: contenders(input.contenders, names),
          }),
          Date.now(),
        )
        .run();
      return reply({ ok: true });
    }
    if (input.action === 'delete-template') {
      await database()
        .prepare('DELETE FROM templates WHERE id=? AND account_id=?')
        .bind(text(input.id, 80), a.id)
        .run();
      return reply({ ok: true });
    }
    const id = text(input.id, 80);
    if (input.action === 'delete-bracket') {
      const owner = await database()
        .prepare('SELECT owner FROM brackets WHERE id=?')
        .bind(id)
        .first<{ owner: string }>();
      if (!owner)
        throw new UserError('This bracket is no longer available.', 404);
      if (owner.owner !== viewer)
        throw new UserError('Only the creator can delete this bracket.', 403);
      const result = await database().batch([
        ...[
          'participation',
          'notifications',
          'reports',
          'bracket_activity',
        ].map((table) =>
          database()
            .prepare(
              'DELETE FROM ' +
                table +
                ' WHERE bracket_id=? AND EXISTS (SELECT 1 FROM brackets WHERE id=? AND owner=?)',
            )
            .bind(id, id, viewer),
        ),
        database()
          .prepare('DELETE FROM brackets WHERE id=? AND owner=?')
          .bind(id, viewer),
      ]);
      if (result[result.length - 1].meta.changes !== 1)
        throw new UserError('The bracket changed. Refresh and try again.', 409);
      return reply({ ok: true });
    }
    const row = await read(id);
    const state = normalizeState(row.state);
    if (input.action === 'report') {
      const reason = text(input.reason, 500);
      if (reason.length < 5)
        throw new UserError(
          'Tell us what should be reviewed (at least 5 characters).',
        );
      await database()
        .prepare(
          'INSERT INTO reports (id,account_id,bracket_id,reason,created_at,resolved) VALUES (?,?,?,?,?,0)',
        )
        .bind(crypto.randomUUID(), a.id, id, reason, Date.now())
        .run();
      return reply({ ok: true });
    }
    if (input.action === 'moderate') {
      if (!(await isAdmin(a.id)))
        throw new UserError('Administrator access required.', 403);
      if (['approved', 'hidden', 'pending'].includes(input.moderation))
        state.moderation = input.moderation;
      state.featured = input.featured === true;
      state.official = input.official === true;
    } else if (input.action === 'resolve-report') {
      if (!(await isAdmin(a.id)))
        throw new UserError('Administrator access required.', 403);
      await database()
        .prepare('UPDATE reports SET resolved=1 WHERE id=?')
        .bind(text(input.reportId, 80))
        .run();
      return reply({ ok: true });
    } else if (input.action === 'edit') {
      if (row.owner !== viewer)
        throw new UserError('Only the creator can edit this bracket.', 403);
      const title = text(input.title, 80);
      if (!title) throw new UserError('Add a title.');
      if (input.entries) {
        if (
          state.rounds.some((r) => r.some((m) => Object.keys(m.ballots).length))
        )
          throw new UserError(
            'Contenders are locked after the first vote.',
            409,
          );
        const names = input.entries;
        if (
          !Array.isArray(names) ||
          ![4, 8, 16, 32].includes(names.length) ||
          names.some(
            (n) => typeof n !== 'string' || !n.trim() || n.length > 60,
          ) ||
          new Set(names.map((n) => n.trim().toLowerCase())).size !==
            names.length
        )
          throw new UserError('Use 4, 8, 16, or 32 unique names.');
        state.rounds = [
          Array.from({ length: names.length / 2 }, (_, i) => ({
            a: names[i * 2],
            b: names[i * 2 + 1],
            ballots: {},
          })),
        ];
        state.contenders = contenders(input.contenders, names);
      }
      state.category = text(input.category, 40) || 'Other';
      if (state.moderation === 'approved') state.moderation = 'pending';
      row.title = title;
      row.description = text(input.description, 200);
    } else throw new UserError('Unknown action.');
    const result = await database()
      .prepare(
        'UPDATE brackets SET title=?,description=?,state=?,version=version+1 WHERE id=? AND version=?',
      )
      .bind(row.title, row.description, JSON.stringify(state), id, row.version)
      .run();
    if (result.meta.changes !== 1)
      throw new UserError('The bracket changed. Refresh and try again.', 409);
    return reply({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
