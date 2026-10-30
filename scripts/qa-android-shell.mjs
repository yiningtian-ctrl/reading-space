import {chromium} from 'playwright-core';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile('android/app/src/main/assets/downloads.js','utf8');
const back=await readFile('android/app/src/main/assets/native-back.js','utf8');
const origin='https://reading-space-a42.pages.dev';
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(origin+'/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><section class="mobile-install" style="display:grid"><div class="mobile-install-intro">Install</div><div class="mobile-install-help"><p role="status">Offline ready</p><button>更新应用</button></div></section><button>Export</button></body></html>'}));
 await page.goto(origin+'/native-test');
 async function connect(token){await page.evaluate(source.replace('__READSPACE_PORT_TOKEN__',JSON.stringify(token)));await page.evaluate(token=>{const c=new MessageChannel();window.nativeChannel=c;window.nativeResult=null;c.port1.onmessage=e=>window.nativeResult=JSON.parse(e.data);window.postMessage(token,location.origin,[c.port2]);},token);await page.waitForTimeout(30);}
 async function download(name,text,type){await page.evaluate(({name,text,type})=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();}, {name,text,type});await page.waitForFunction(()=>window.nativeResult!==null);return page.evaluate(()=>window.nativeResult);}
 await connect('first-navigation');
 assert.equal(await page.locator('.mobile-install-intro').isVisible(),false);
 assert.equal(await page.getByRole('status').isVisible(),true);
 assert.equal(await page.getByRole('button',{name:'更新应用'}).isVisible(),true);
 const backup=await download('readspace-backup.json','{"word":"空间"}','application/json');assert.equal(backup.name,'readspace-backup.json');assert.equal(Buffer.from(backup.body,'base64').toString(),'{"word":"空间"}');
 await connect('same-document-reconnect');
 const csv=await download('readspace-vocabulary.csv','\uFEFF单词,释义\r\nspace,空间','text/csv;charset=utf-8');assert.equal(csv.type,'text/csv');assert.equal(Buffer.from(csv.body,'base64').toString(),'\uFEFF单词,释义\r\nspace,空间');
 await connect('oversize');const oversized=await download('large.json','x'.repeat(10_000_001),'application/json');assert.equal(oversized.error,true);
 await page.evaluate(()=>{document.body.insertAdjacentHTML('beforeend','<div role="dialog" aria-modal="true"><input value="keep reading"></div>');document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('[role=dialog]')?.remove();},{once:true});});
 assert.equal(await page.evaluate(back),true);assert.equal(await page.locator('[role=dialog]').count(),0);
 await page.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<div role="dialog" aria-modal="true" hidden>Hidden</div>'));
 assert.equal(await page.evaluate(back),false);
 await page.evaluate(()=>{document.body.insertAdjacentHTML('beforeend','<div class="reader-toolbar"><button aria-label="阅读设置" aria-expanded="true">Settings</button></div>');const button=document.querySelector('.reader-toolbar button');button.onclick=()=>button.setAttribute('aria-expanded','false');});
 assert.equal(await page.evaluate(back),true);assert.equal(await page.evaluate(back),false);
 assert.deepEqual(errors,[]);console.log('PASS Android shell: UTF-8 JSON/CSV exports, repeated port connection, size limit, visible offline/update state, modal/settings Back handling.');
}finally{await browser.close();}

