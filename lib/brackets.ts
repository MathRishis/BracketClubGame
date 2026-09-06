import { database } from '@/db';
export type Match = { a:string; b:string; ballots:Record<string,number>; winner?:string };
export type State = { rounds:Match[][]; current:number; champion?:string };
type Row = { id:string; owner:string; title:string; description:string; state:string; version:number };
export class UserError extends Error { constructor(message:string,public status=400){super(message);} }
export async function identity(req:Request){
 const cookie=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('bc_player='))?.slice(10);
 const token=cookie&&/^[0-9a-f-]{36}$/.test(cookie)?cookie:crypto.randomUUID();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 return {hash,cookie:cookie===token?null:`bc_player=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol==='https:'?'; Secure':''}`};
}
export function reply(data:unknown,status=200,cookie:string|null=null){const headers:Record<string,string>={'Cache-Control':'no-store'};if(cookie)headers['Set-Cookie']=cookie;return Response.json(data,{status,headers});}
export function failure(e:unknown){return reply({error:e instanceof UserError?e.message:'Unable to save right now. Please try again.'},e instanceof UserError?e.status:500);}
export async function body(req:Request){if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)throw new UserError('This request is not allowed.',403);const text=await req.text();if(text.length>12000)throw new UserError('That bracket is too large.');try{return JSON.parse(text);}catch{throw new UserError('Invalid request.');}}
export async function read(id:string){const row=await database().prepare('SELECT id,owner,title,description,state,version FROM brackets WHERE id = ?').bind(id).first<Row>();if(!row)throw new UserError('This bracket could not be found. Check your invite link.',404);return row;}
export function visible(row:Row,viewer:string){const state=JSON.parse(row.state) as State;let total=0;return {id:row.id,title:row.title,description:row.description,current:state.current,champion:state.champion,owner:row.owner===viewer,rounds:state.rounds.map(round=>round.map(m=>{const votes=[0,0];Object.values(m.ballots).forEach(p=>votes[p]++);total+=votes[0]+votes[1];return {a:m.a,b:m.b,votes,pick:m.ballots[viewer],winner:m.winner};})),total};}
export function mutate(state:State,input:any,viewer:string,isOwner:boolean){
 if(state.champion)throw new UserError('This bracket has already crowned a champion.',409);
 if(input.round!==state.current)throw new UserError('The round has changed. Refresh and vote in the new round.',409);
 const matches=state.rounds[state.current];
 if(input.action==='vote'){
  if(!Number.isInteger(input.match)||!matches[input.match]||![0,1].includes(input.pick))throw new UserError('Choose a valid contender.');
  const match=matches[input.match];if(Object.keys(match.ballots).length>=5000&&match.ballots[viewer]===undefined)throw new UserError('This matchup has reached its voter limit.');
  match.ballots[viewer]=input.pick;
 }else if(input.action==='advance'){
  if(!isOwner)throw new UserError('Only the host can close a round.',403);
  const winners=matches.map(m=>{const votes=[0,0];Object.values(m.ballots).forEach(p=>votes[p]++);if(votes[0]===votes[1])throw new UserError('Every matchup needs a winner. Invite more votes to break ties before closing this round.',409);return votes[0]>votes[1]?m.a:m.b;});
  matches.forEach((m,i)=>m.winner=winners[i]);
  if(winners.length===1)state.champion=winners[0];else{state.rounds.push(Array.from({length:winners.length/2},(_,i)=>({a:winners[i*2],b:winners[i*2+1],ballots:{}})));state.current++;}
 }else throw new UserError('Unknown action.');
 return state;
}
export async function update(id:string,input:unknown,viewer:string){
 for(let attempt=0;attempt<6;attempt++){
  const row=await read(id);const state=mutate(JSON.parse(row.state),input,viewer,row.owner===viewer);const serialized=JSON.stringify(state);
  const result=await database().prepare('UPDATE brackets SET state = ?, version = version + 1 WHERE id = ? AND version = ?').bind(serialized,id,row.version).run();
  if(result.meta.changes===1)return visible({...row,state:serialized},viewer);
 }
 throw new UserError('The votes are coming in quickly. Please try again.',409);
}
