import { maintenance } from '@/lib/community';
import {
  identity,
  body,
  read,
  visible,
  update,
  reply,
  failure,
  UserError,
} from '@/lib/brackets';
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  try {
    const { id } = await ctx.params;
    const user = await identity(req);
    return reply(visible(await read(id), user.hash), 200, user.cookie);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    const { id } = await ctx.params;
    await maintenance();
    const input = await body(req);
    if (!input || typeof input !== 'object')
      throw new UserError('Invalid action.');
    const user = await identity(req);
    const action = input as {
      action?: unknown;
      settings?: { visibility?: unknown };
    };
    if (
      action.action === 'configure' &&
      action.settings?.visibility === 'worldwide' &&
      !user.account
    )
      throw new UserError(
        'Sign in before publishing a worldwide bracket.',
        401,
      );
    return reply(await update(id, input, user.hash), 200, user.cookie);
  } catch (e) {
    return failure(e);
  }
}
