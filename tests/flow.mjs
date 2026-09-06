import assert from 'node:assert/strict';
const base=process.env.TEST_ORIGIN||'http://localhost:3000';
const clients={host:'',friend:''};
async function call(who,path,data,expected=200){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:clients[who]||'',Origin:base},body:data?JSON.stringify(data):undefined});const cookie=r.headers.get('set-cookie');if(cookie)clients[who]=cookie.split(';')[0];const result=await r.json();assert.equal(r.status,expected,JSON.stringify(result));return result;}
const g=await call('host','/api/brackets',{title:'Test tournament',entries:['A','B','C','D']},201);
const path='/api/brackets/'+g.id;
assert.equal(g.owner,true);assert.equal((await call('friend',path)).owner,false);
await call('friend',path,{action:'advance',round:0},403);
await call('host',path,{action:'advance',round:0},409);
await call('friend',path,{action:'vote',round:0,match:0,pick:0});
let changed=await call('friend',path,{action:'vote',round:0,match:0,pick:1});
assert.deepEqual(changed.rounds[0][0].votes,[0,1]);assert.equal(changed.total,1);
await Promise.all([call('host',path,{action:'vote',round:0,match:0,pick:1}),call('friend',path,{action:'vote',round:0,match:1,pick:0})]);
changed=await call('host',path);assert.equal(changed.total,3);
const next=await call('host',path,{action:'advance',round:0});assert.equal(next.current,1);assert.equal(next.rounds[1][0].a,'B');assert.equal(next.rounds[1][0].b,'C');
await call('friend',path,{action:'vote',round:0,match:0,pick:0},409);
await call('friend',path,{action:'vote',round:1,match:0,pick:1});
const done=await call('host',path,{action:'advance',round:1});assert.equal(done.champion,'C');
await call('friend',path,{action:'vote',round:1,match:0,pick:0},409);
await call('host','/api/brackets',{title:'Invalid',entries:['A','a','C','D']},400);
console.log('PASS: creation, shared state, host authorization, vote changes, concurrent votes, ties, advancement, stale rounds, champion, input validation.');
const large=await call('host','/api/brackets',{title:'32-entry tournament',entries:Array.from({length:32},(_,i)=>`Entry ${i+1}`)},201);
const largePath='/api/brackets/'+large.id;
let largeState=large;
for(let round=0;round<5;round++){
 const count=16/2**round;
 assert.equal(largeState.rounds[round].length,count);
 if(round<4){assert.equal(largeState.rounds[round][0].a,'Entry 1');assert.equal(largeState.rounds[round][count/2].a,'Entry 17');}
 else {assert.equal(largeState.rounds[4][0].a,'Entry 1');assert.equal(largeState.rounds[4][0].b,'Entry 17');}
 for(let match=0;match<count;match++)await call('friend',largePath,{action:'vote',round,match,pick:round===4?1:0});
 largeState=await call('host',largePath,{action:'advance',round});
}
assert.equal(largeState.champion,'Entry 17');assert.equal(largeState.total,31);
console.log('PASS: 32 contenders, independent 16-entry halves, five rounds, cross-side final, and champion.');
const {starterKits}=await import('../lib/starter-kits.ts');
for(const kit of starterKits){
 const created=await call('host','/api/brackets',kit,201);
 assert.equal(created.title,kit.title);
 assert.equal(created.rounds[0].length*2,kit.entries.length);
 assert.deepEqual(created.rounds[0].flatMap(m=>[m.a,m.b]),kit.entries);
}
console.log('PASS: every starter kit creates a valid bracket with its exact title and contenders.');
