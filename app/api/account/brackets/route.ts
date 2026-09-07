import { database } from '@/db';
import { accountFromRequest } from '@/lib/auth';
import { failure, reply, summary, UserError, type Row } from '@/lib/brackets';

export async function GET(req: Request) {
  try {
    const account = await accountFromRequest(req); if (!account) throw new UserError('Sign in to see your bracket history.', 401);
    const viewer = `account:${account.id}`;
    const owned = await database().prepare('SELECT id,owner,title,description,state,version,created_at FROM brackets WHERE owner=? ORDER BY created_at DESC LIMIT 50').bind(viewer).all<Row>();
    const voted = await database().prepare(`SELECT b.id,b.owner,b.title,b.description,b.state,b.version,b.created_at FROM bracket_activity a JOIN brackets b ON b.id=a.bracket_id WHERE a.account_id=? AND a.kind='voted' AND b.owner<>? ORDER BY a.updated_at DESC LIMIT 50`).bind(account.id, viewer).all<Row>();
    return reply({ account, owned: owned.results.map((row) => summary(row, viewer)), voted: voted.results.map((row) => summary(row, viewer)) });
  } catch (error) { return failure(error); }
}
