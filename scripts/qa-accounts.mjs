import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {defaultData} from '../lib/reading.ts';
const origin=process.env.QA_URL||'http://127.0.0.1:8789';
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):/.test(origin))throw new Error('Account QA creates fixtures; only local test databases are allowed.');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],username='qa_sync_'+Date.now().toString(36),password='qa-password-'+crypto.randomUUID();
const guest={...structuredClone(defaultData),saved:['green-spaces'],words:[{id:'qa-word',word:'attention',meaning:'注意力',pos:'n.',sentence:'Reading needs attention.',articleId:'green-spaces',articleTitle:'The Quiet Power of Green Spaces',addedAt:'2026-10-29T12:00:00Z',mastered:false}],notes:[{id:'qa-note',articleId:'green-spaces',quote:'Green spaces matter.',text:'旧设备的思考',paragraph:0,addedAt:'2026-10-29T12:00:00Z'}],records:{'green-spaces':{progress:36,seconds:150,lastReadAt:'2026-10-29T12:00:00Z'}}};
const contexts=[];
async function setup(seed,storageState){
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'zh-CN',reducedMotion:'reduce',...(storageState?{storageState}:{})});contexts.push(c);
 if(seed)await c.addInitScript(value=>{if(!localStorage.getItem('readspace.study.v1'))localStorage.setItem('readspace.study.v1',JSON.stringify(value));},seed);
 const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/discover*',r=>r.fulfill({json:{articles:[],status:'fallback',sources:[],checkedAt:new Date().toISOString()}}));
 await p.goto(origin+'/#profile',{waitUntil:'networkidle'});return{c,p};
}
async function waitCloud(c,predicate){for(let i=0;i<80;i++){const r=await c.request.get(origin+'/api/study-sync');if(r.ok()){const value=await r.json();if(predicate(value))return value;}await new Promise(r=>setTimeout(r,120));}throw new Error('Cloud record did not reach expected state');}
const active=p=>p.evaluate(()=>{const user=JSON.parse(localStorage.getItem('readspace.account.v1')||'null');return user?JSON.parse(localStorage.getItem('readspace.study.user.'+user.id)||'null'):null;});
const profile=p=>p.locator('.quiet-dock').getByRole('button',{name:/^我的 /}).click();
const notebook=p=>p.locator('.quiet-dock').getByRole('button',{name:/^词句本 /}).click();
async function editWord(p,meaning){await notebook(p);await p.locator('.notebook-word summary').first().click();await p.getByRole('button',{name:'编辑释义',exact:true}).first().click();await p.getByLabel('我的释义',{exact:true}).fill(meaning);await p.getByRole('dialog').getByRole('button',{name:'保存',exact:true}).click();}
async function login(p,mode='登录',pass=password,name=username){await p.locator('.account-tabs').getByRole('button',{name:mode,exact:true}).click();await p.getByLabel('用户名',{exact:true}).fill(name);await p.getByLabel('密码',{exact:true}).fill(pass);await p.getByRole('button',{name:mode==='注册'?'创建账号':'登录并同步',exact:true}).click();await p.locator('.account-status strong').filter({hasText:name}).waitFor();}
await mkdir('outputs/qa/accounts',{recursive:true});
try{
 const a=await setup(guest);await login(a.p,'注册');await a.p.getByText('请保存账号恢复码',{exact:true}).waitFor();
 const recovery=(await a.p.locator('.account-recovery code').textContent()).trim();assert.match(recovery,/^[a-f0-9]{64}$/);
 const downloaded=a.p.waitForEvent('download');await a.p.getByRole('button',{name:'下载恢复码',exact:true}).click();const recoveryFile=await downloaded;assert.equal(JSON.parse(await readFile(await recoveryFile.path(),'utf8')).username,username);
 await a.p.getByRole('button',{name:'我已保存',exact:true}).click();assert.equal((await a.c.request.get(origin+'/api/study-sync').then(r=>r.json())).data,null);
 assert.equal(await a.p.getByText('发现这台设备原来的阅读记录',{exact:true}).count(),1);assert.deepEqual(await a.p.evaluate(()=>JSON.parse(localStorage.getItem('readspace.study.v1'))),guest);
 await a.p.getByRole('button',{name:'合并本机旧记录',exact:true}).click();await waitCloud(a.c,v=>v.data?.words.length===1&&v.data?.notes.length===1);console.log('PASS registration, recovery download and explicit guest migration preserve the old browser records');
 const b=await setup();await b.p.setViewportSize({width:1440,height:900});await login(b.p);await b.p.getByText('已同步',{exact:false}).first().waitFor();assert.equal((await active(b.p)).words[0].id,'qa-word');assert.equal((await active(b.p)).notes[0].text,'旧设备的思考');assert.equal((await active(b.p)).records['green-spaces'].progress,36);assert.equal(await b.p.evaluate(()=>localStorage.getItem('readspace.study.v1')),null);
 await b.p.getByLabel('给自己留一点阅读时间',{exact:false}).selectOption('30');await waitCloud(b.c,v=>v.data?.settings.dailyGoal===30);
 await a.p.getByRole('button',{name:'立即同步',exact:true}).click();await a.p.waitForFunction(()=>{const u=JSON.parse(localStorage.getItem('readspace.account.v1'));return JSON.parse(localStorage.getItem('readspace.study.user.'+u.id)).settings.dailyGoal===30;});
 await a.p.screenshot({path:'outputs/qa/accounts/mobile-synced.png'});await b.p.screenshot({path:'outputs/qa/accounts/desktop-synced.png'});console.log('PASS a second independent device logs into the account, receives records and syncs a changed reading goal back');
 await b.c.setOffline(true);await b.p.getByLabel('给自己留一点阅读时间',{exact:false}).selectOption('45');await b.p.waitForTimeout(2200);assert.equal((await active(b.p)).settings.dailyGoal,45);
 const saved=await b.c.storageState();await b.c.close();const restored=await setup(undefined,saved);await waitCloud(restored.c,v=>v.data?.settings.dailyGoal===45);console.log('PASS offline changes survive closing a device and upload on its next online visit');
 await a.p.getByRole('button',{name:'立即同步',exact:true}).click();await a.p.waitForTimeout(300);
 await restored.c.setOffline(true);await editWord(restored.p,'手机上的释义');await editWord(a.p,'电脑上的释义');await waitCloud(a.c,v=>v.data?.words[0]?.meaning==='电脑上的释义');
 await a.p.getByRole('tab',{name:/句子/}).click();await a.p.getByRole('button',{name:'编辑批注',exact:true}).click();await a.p.getByLabel('我的理解',{exact:true}).fill('电脑上新增的思考');await a.p.getByRole('dialog').getByRole('button',{name:'保存',exact:true}).click();await waitCloud(a.c,v=>v.data?.notes[0]?.text==='电脑上新增的思考');
 await profile(restored.p);await restored.c.setOffline(false);await restored.p.getByRole('button',{name:'冲突处保留本机',exact:true}).waitFor();await restored.p.screenshot({path:'outputs/qa/accounts/conflict.png'});await restored.p.getByRole('button',{name:'冲突处保留本机',exact:true}).click();await waitCloud(restored.c,v=>v.data?.words[0]?.meaning==='手机上的释义'&&v.data?.notes[0]?.text==='电脑上新增的思考');console.log('PASS simultaneous definition edits require a decision while an independent annotation is retained');
 await restored.p.getByRole('button',{name:'退出登录',exact:true}).click();await restored.p.getByRole('button',{name:'创建账号',exact:true}).count();await login(restored.p,'注册',password,username+'_b');await restored.p.getByRole('button',{name:'我已保存',exact:true}).click();assert.equal((await active(restored.p)).words.length,0);assert.equal((await active(restored.p)).notes.length,0);console.log('PASS logging out and creating a different account does not expose or upload the previous account data');
 const fresh=await setup();await fresh.p.locator('.account-tabs').getByRole('button',{name:'找回密码',exact:true}).click();await fresh.p.getByLabel('用户名',{exact:true}).fill(username);await fresh.p.getByLabel('账号恢复码',{exact:true}).fill(recovery);const replacement='changed-'+password;await fresh.p.getByLabel('设置新密码',{exact:true}).fill(replacement);await fresh.p.getByRole('button',{name:'重设密码并登录',exact:true}).click();await fresh.p.getByText('请保存账号恢复码',{exact:true}).waitFor();assert.notEqual(await fresh.p.locator('.account-recovery code').textContent(),recovery);
 await profile(a.p);await a.p.getByRole('button',{name:'立即同步',exact:true}).click();await a.p.getByRole('button',{name:'登录并同步',exact:true}).waitFor();assert.equal((await active(a.p)).words.length,1);console.log('PASS recovery rotates the code, revokes previous device sessions and preserves study records');
 for(const width of [320,390,768,1440]){await fresh.p.setViewportSize({width,height:900});assert.equal(await fresh.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);}
 assert.deepEqual(errors,[]);console.log('All real D1 account browser checks passed; no browser exceptions.');
}finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();}
