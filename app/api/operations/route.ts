import { env } from 'cloudflare:workers';
import { database } from '@/db';
import { body, reply, failure, UserError } from '@/lib/brackets';
export async function POST(req: Request) {
  try {
    const secret = (env as unknown as Record<string, string>).OPERATIONS_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
      throw new UserError('Not found.', 404);
    const input = await body(req);
    if (input.action === 'maintenance') {
      await database()
        .prepare(
          "INSERT INTO operations (key,value) VALUES ('maintenance',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .bind(input.enabled ? '1' : '0')
        .run();
      return reply({ ok: true });
    }
    if (input.action === 'reset') {
      const flag = await database()
        .prepare("SELECT value FROM operations WHERE key='maintenance'")
        .first<{ value: string }>();
      if (flag?.value !== '1') throw new UserError('Enable maintenance first.');
      if (
        await database()
          .prepare(
            "SELECT value FROM operations WHERE key='fresh-start-complete'",
          )
          .first()
      )
        throw new UserError('The fresh start has already completed.', 409);
      await database().batch(
        [
          'participation',
          'notifications',
          'reports',
          'templates',
          'community_accounts',
          'sessions',
          'bracket_activity',
          'brackets',
          'accounts',
        ]
          .map((t) => database().prepare(`DELETE FROM ${t}`))
          .concat([
            database().prepare(
              "INSERT INTO operations (key,value) VALUES ('fresh-start-complete','1')",
            ),
          ]),
      );
      return reply({ ok: true });
    }
    if (input.action === 'assign-admin') {
      if (!input.accountId || !input.username)
        throw new UserError('Supply the new account ID and username.');
      const a = await database()
        .prepare('SELECT id FROM accounts WHERE id=? AND username=?')
        .bind(input.accountId, input.username)
        .first();
      if (!a) throw new UserError('Account does not match.', 404);
      await database()
        .prepare(
          'INSERT INTO community_accounts (account_id,admin) VALUES (?,1) ON CONFLICT(account_id) DO UPDATE SET admin=1',
        )
        .bind(input.accountId)
        .run();
      return reply({ ok: true });
    }
    throw new UserError('Unknown action.');
  } catch (e) {
    return failure(e);
  }
}
