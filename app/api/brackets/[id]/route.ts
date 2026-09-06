import { identity, body, read, visible, update, reply, failure, UserError } from '@/lib/brackets';
type Context = {params:Promise<{id:string}>};
export async function GET(req:Request,ctx:Context){try{const {id}=await ctx.params;const user=await identity(req);return reply(visible(await read(id),user.hash),200,user.cookie);}catch(e){return failure(e);}}
export async function POST(req:Request,ctx:Context){try{const {id}=await ctx.params;const input=await body(req);if(!input||typeof input!=='object')throw new UserError('Invalid action.');const user=await identity(req);return reply(await update(id,input,user.hash),200,user.cookie);}catch(e){return failure(e);}}
