import { accountFromRequest, login, logout, signup } from '@/lib/auth';
import { body, failure, reply, UserError } from '@/lib/brackets';

export async function GET(req: Request) { try { return reply({ account: await accountFromRequest(req) }); } catch (error) { return failure(error); } }
export async function POST(req: Request) {
  try {
    const input = await body(req) as { action?: string };
    if (input.action === 'logout') return reply({ account: null }, 200, await logout(req));
    let result;
    try { result = input.action === 'signup' ? await signup(req, input) : input.action === 'login' ? await login(req, input) : null; }
    catch (error) { throw new UserError(error instanceof Error ? error.message : 'Unable to sign in.'); }
    if (!result) throw new UserError('Unknown account action.');
    return reply({ account: result.account }, input.action === 'signup' ? 201 : 200, result.cookie);
  } catch (error) { return failure(error); }
}
