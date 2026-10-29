import {test} from 'node:test';import assert from 'node:assert/strict';
import {TestD1,device,password,word} from './account-test-helpers.mjs';
import {handleAccount,hashPassword} from '../lib/account-server.mjs';
import {defaultData} from '../lib/reading.ts';
import {sendVerificationMail} from '../lib/smtp-mail.mjs';
async function proof(c,email,purpose){const r=await c.request('/api/account/email/send','POST',{email,purpose});assert.equal(r.status,200);return{email,challengeId:(await r.json()).challengeId,code:c.mail.at(-1).code};}
test('Email proof is required for registration; email login is single-use and never creates duplicate accounts',async()=>{const db=new TestD1();try{
 const a=device(db),email='owner@example.test';
 assert.equal((await a.request('/api/account/register','POST',{username:'alice',password,email})).status,400);
 const p=await proof(a,email,'register');assert.equal((await a.request('/api/account/email/login','POST',p)).status,400);
 const r=await a.request('/api/account/register','POST',{username:'alice',password,...p});assert.equal(r.status,201);const user=(await r.json()).user;assert.equal(user.email,email);
 a.now+=61000;const login=await proof(a,email,'login');const b=device(db,'192.0.2.2');b.now=a.now;
 const results=await Promise.all([a.request('/api/account/email/login','POST',login),b.request('/api/account/email/login','POST',login)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM rs_users').get().n,1);
 assert.notEqual(db.sql.prepare('SELECT code_hash FROM rs_email_codes WHERE id=?').get(login.challengeId).code_hash,login.code);
 }finally{db.close();}});
test('Wrong codes lock after five attempts; expired codes, cooldown and SMTP failures cannot authenticate',async()=>{const db=new TestD1();try{
 const a=device(db);const p=await proof(a,'test@example.test','login');assert.equal((await a.request('/api/account/email/send','POST',{email:p.email,purpose:'login'})).status,429);
 for(let i=0;i<5;i++)assert.equal((await a.request('/api/account/email/login','POST',{...p,code:p.code==='000000'?'111111':'000000'})).status,400);
 assert.equal((await a.request('/api/account/email/login','POST',p)).status,400);
 a.now+=61000;const expired=await proof(a,'expired@example.test','login');a.now+=601000;assert.equal((await a.request('/api/account/email/login','POST',expired)).status,400);
 const r=await handleAccount(new Request('https://test/api/account/email/send',{method:'POST',headers:{Origin:'https://test','Content-Type':'application/json'},body:JSON.stringify({email:'failed@example.test',purpose:'login'})}),db,{mailSecret:'test-secret',sendMail:async()=>{throw new Error('SMTP secret must never leak');}});assert.equal(r.status,502);assert.ok(!(await r.text()).includes('SMTP secret'));
 }finally{db.close();}});
test('Legacy account must bind verified unique email without losing its existing cloud snapshot',async()=>{const db=new TestD1();try{
 const a=device(db);await a.request('/api/account/session');const id=crypto.randomUUID(),data={...structuredClone(defaultData),words:[word('preserved')]};
 db.sql.prepare('INSERT INTO rs_users VALUES(?,?,?,?,?)').run(id,'legacy',await hashPassword(password),'old-recovery',Date.now());db.sql.prepare('INSERT INTO rs_study(user_id,revision,data) VALUES(?,1,?)').run(id,JSON.stringify(data));
 assert.equal((await a.request('/api/account/login','POST',{username:'legacy',password})).status,200);assert.equal((await a.request('/api/study-sync')).status,403);
 const p=await proof(a,'legacy@example.test','bind');const thief=device(db,'192.0.2.3');assert.equal((await thief.request('/api/account/email/bind','POST',p)).status,401);
 assert.equal((await a.request('/api/account/email/bind','POST',p)).status,200);assert.equal((await(await a.request('/api/study-sync')).json()).data.words[0].id,'preserved');
 const b=device(db,'192.0.2.4');await b.request('/api/account/register','POST',{username:'other',password});db.sql.prepare('DELETE FROM rs_emails WHERE user_id=(SELECT id FROM rs_users WHERE username=?)').run('other');b.now+=61000;const duplicate=await proof(b,p.email,'bind');assert.equal((await b.request('/api/account/email/bind','POST',duplicate)).status,409);
 }finally{db.close();}});
test('TLS SMTP handles multiline responses, fixed sender and body encoding without command injection',async()=>{
 let control;const commands=[];const readable=new ReadableStream({start(c){control=c;}}),enc=new TextEncoder();const reply=s=>control.enqueue(enc.encode(s+'\r\n'));reply('220 ready');
 const writable=new WritableStream({write(bytes){const text=new TextDecoder().decode(bytes);commands.push(text);const count=commands.length;reply(count===1?'250-test\r\n250 AUTH LOGIN':count===2||count===3?'334 challenge':count===4?'235 authenticated':count===7?'354 data':'250 accepted');}});
 const connect=(address,options)=>{assert.equal(address.hostname,'smtp.163.com');assert.equal(address.port,465);assert.equal(options.secureTransport,'on');return{readable,writable,opened:Promise.resolve(),closed:Promise.resolve(),close:async()=>{}};};
 await sendVerificationMail('test-authorization-code',{to:'recipient@example.test',code:'123456',purpose:'login'},connect,'test-sender@163.com');assert.ok(commands[4].includes('test-sender@163.com'));assert.ok(commands[7].includes('Content-Transfer-Encoding: base64'));assert.ok(!commands[7].includes('test-authorization-code'));
 await assert.rejects(()=>sendVerificationMail('secret',{to:'bad\r\nRCPT TO:<victim@example.test>',code:'123456'},connect,'test-sender@163.com'));
});
