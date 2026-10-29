import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleAccount,hashPassword} from '../lib/account-server.mjs';
import {defaultData} from '../lib/reading.ts';
import {TestD1,device,password,word} from './account-test-helpers.mjs';
const snapshot=()=>({...structuredClone(defaultData),words:[word('first')]});

test('D1 is optional; requests require same origin and valid JSON before writes',async()=>{
 assert.equal((await handleAccount(new Request('https://test/api/account/session'),undefined)).status,503);
 const db=new TestD1();try{
  assert.equal((await handleAccount(new Request('https://test/api/account/register',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}),db)).status,403);
  assert.equal((await handleAccount(new Request('https://test/api/account/register',{method:'POST',headers:{Origin:'https://test','Content-Type':'text/plain'},body:'{}'}),db)).status,415);
  const c=device(db);assert.equal((await c.request('/api/account/register','POST',{username:'aa',password})).status,400);
  assert.equal((await c.request('/api/account/register','POST',{username:'alice',password:'short'})).status,400);
 }finally{db.close();}
});
test('Passwords are salted hashes; session is HttpOnly, Secure, same-site, and only its hash is stored',async()=>{
 const db=new TestD1();try{
  const a=device(db),r=await a.request('/api/account/register','POST',{username:'Alice',password});assert.equal(r.status,201);const result=await r.json();
  assert.equal(result.user.username,'alice');assert.match(result.recoveryCode,/^[a-f0-9]{64}$/);
  assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/Secure/);assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);
  const stored=db.sql.prepare('SELECT * FROM rs_users').get();assert.notEqual(stored.password_hash,password);assert.notEqual(stored.recovery_hash,result.recoveryCode);
  assert.notEqual((await hashPassword(password)),stored.password_hash);
  assert.notEqual(db.sql.prepare('SELECT token_hash FROM rs_sessions').get().token_hash,a.cookie().split('=')[1]);
  assert.equal((await (await a.request('/api/account/session')).json()).user.id,result.user.id);
  assert.equal((await device(db).request('/api/study-sync')).status,401);
  assert.equal((await device(db).request('/api/account/login','POST',{username:'alice',password:'wrong-password'})).status,401);
  assert.equal((await device(db).request('/api/account/register','POST',{username:'alice',password})).status,409);
 }finally{db.close();}
});
test('Snapshots are scoped to session user; stale writes and invalid backups cannot replace stored data',async()=>{
 const db=new TestD1();try{
  const a=device(db),b=device(db,'192.0.2.2');const user=await(await a.request('/api/account/register','POST',{username:'alice',password})).json();await b.request('/api/account/register','POST',{username:'bob',password});
  assert.equal((await a.request('/api/study-sync','PUT',{revision:0,data:snapshot()})).status,200);
  assert.equal((await a.request('/api/study-sync','PUT',{revision:0,data:defaultData})).status,409);
  assert.equal((await a.request('/api/study-sync','PUT',{revision:1,data:{}})).status,400);
  const duplicate=snapshot();duplicate.words.push(word('first'));assert.equal((await a.request('/api/study-sync','PUT',{revision:1,data:duplicate})).status,400);
  const poisoned=JSON.parse(JSON.stringify(snapshot()));poisoned.records=JSON.parse('{"__proto__":{"progress":0,"seconds":0,"lastReadAt":"now"}}');assert.equal((await a.request('/api/study-sync','PUT',{revision:1,data:poisoned})).status,400);
  assert.equal((await b.request('/api/study-sync','PUT',{revision:0,data:defaultData,userId:user.user.id})).status,200);
  assert.equal((await(await a.request('/api/study-sync')).json()).data.words.length,1);
  assert.equal((await(await b.request('/api/study-sync')).json()).data.words.length,0);
  const big=snapshot();big.words[0].meaning='a'.repeat(1_600_000);assert.equal((await a.request('/api/study-sync','PUT',{revision:1,data:big})).status,413);
 }finally{db.close();}
});
test('Logout and expiry revoke access; recovery rotates code and all sessions without deleting study data',async()=>{
 const db=new TestD1();try{
  const a=device(db),other=device(db,'192.0.2.2');const original=await(await a.request('/api/account/register','POST',{username:'alice',password})).json();
  await a.request('/api/study-sync','PUT',{revision:0,data:snapshot()});await other.request('/api/account/login','POST',{username:'alice',password});
  const recover=device(db,'192.0.2.3');const r=await recover.request('/api/account/recover','POST',{username:'alice',password:'new-readspace-password',recoveryCode:original.recoveryCode});assert.equal(r.status,200);const replacement=await r.json();assert.notEqual(replacement.recoveryCode,original.recoveryCode);
  assert.equal((await a.request('/api/study-sync')).status,401);assert.equal((await other.request('/api/study-sync')).status,401);
  assert.equal((await(await recover.request('/api/study-sync')).json()).data.words.length,1);
  assert.equal((await device(db).request('/api/account/recover','POST',{username:'alice',password,recoveryCode:original.recoveryCode})).status,401);
  assert.equal((await recover.request('/api/account/logout','POST',{})).status,200);assert.equal((await recover.request('/api/study-sync')).status,401);
  await recover.request('/api/account/login','POST',{username:'alice',password:'new-readspace-password'});recover.now+=31*86400000;assert.equal((await recover.request('/api/study-sync')).status,401);
 }finally{db.close();}
});
test('Login attempts are bounded by username and IP with Retry-After',async()=>{
 const db=new TestD1();try{
  const a=device(db);await a.request('/api/account/register','POST',{username:'alice',password});let r;
  for(let i=0;i<13;i++)r=await a.request('/api/account/login','POST',{username:'alice',password:'incorrect-password'});
  assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'900');
  assert.equal((await device(db,'192.0.2.9').request('/api/account/register','POST',{username:'other_reader',password})).status,201);
 }finally{db.close();}
});

test('A recovery code can be consumed only once even when two recovery requests race',async()=>{
 const db=new TestD1();try{
  const a=device(db);const account=await(await a.request('/api/account/register','POST',{username:'alice',password})).json();
  const b=device(db,'192.0.2.2'),c=device(db,'192.0.2.3');
  const responses=await Promise.all([b.request('/api/account/recover','POST',{username:'alice',password:password+'-b',recoveryCode:account.recoveryCode}),c.request('/api/account/recover','POST',{username:'alice',password:password+'-c',recoveryCode:account.recoveryCode})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,401]);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM rs_sessions').get().n,1);
 }finally{db.close();}
});
