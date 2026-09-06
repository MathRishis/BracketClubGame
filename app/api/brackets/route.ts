import { database } from '@/db';
import { identity, body, reply, failure, UserError, visible } from '@/lib/brackets';
export async function POST(req:Request){try{
 const input=await body(req);if(!input||typeof input!=='object')throw new UserError('Invalid bracket.');
 const {title,description='',entries}=input;
 if(typeof title!=='string'||!title.trim()||title.trim().length>80)throw new UserError('Add a title of up to 80 characters.');
 if(typeof description!=='string'||description.length>200)throw new UserError('Keep the description under 200 characters.');
 if(!Array.isArray(entries)||![4,8,16,32].includes(entries.length)||entries.some(x=>typeof x!=='string'||!x.trim()||x.trim().length>60))throw new UserError('Add 4, 8, 16, or 32 contenders with names under 60 characters.');
 const names=entries.map((x:string)=>x.trim());if(new Set(names.map((x:string)=>x.toLowerCase())).size!==names.length)throw new UserError('Each contender needs a different name.');
 const user=await identity(req);const id=crypto.randomUUID();const state=JSON.stringify({rounds:[Array.from({length:names.length/2},(_,i)=>({a:names[i*2],b:names[i*2+1],ballots:{}}))],current:0});
 await database().prepare('INSERT INTO brackets (id,owner,title,description,state,version,created_at) VALUES (?,?,?,?,?,0,?)').bind(id,user.hash,title.trim(),description.trim(),state,Date.now()).run();
 return reply(visible({id,owner:user.hash,title:title.trim(),description:description.trim(),state,version:0},user.hash),201,user.cookie);
}catch(e){return failure(e);}}
