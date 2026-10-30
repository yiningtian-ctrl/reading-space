import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {defaultData,validateData} from '../lib/reading.ts';

const origin=process.env.QA_URL||'http://127.0.0.1:8793';
const article={id:'qa-translation',title:'Reading Across Devices',subtitle:'Personal reading',description:'A short personal reading text.',source:'个人导入',topic:'科技与学习',level:2,kind:'imported',image:'/images/study.jpg',paragraphs:[
 {en:'A quiet library gives us room to think.',zh:'安静的图书馆给我们思考的空间。'},
 {en:'Reading helps us understand the world.'},
 {en:'Small habits can make a lasting difference.'},
]};
const translations={
 'Reading helps us understand the world.':'阅读帮助我们理解世界。',
 'Small habits can make a lasting difference.':'小习惯可以带来长久的改变。',
};
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],contexts=[];
const state=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('readspace.study.v1')||'null'));
const stored=async page=>(await state(page)).imported.find(a=>a.id===article.id);
async function until(test,label){for(let i=0;i<100;i++){if(await test())return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out: '+label);}
const officialResponse=(route,text,status=200)=>route.fulfill({status,headers:{'access-control-allow-origin':'*'},json:{responseStatus:status,responseData:{translatedText:text},quotaFinished:status===429}});
async function setup(handler,paragraphs=article.paragraphs){
 const seed={...structuredClone(defaultData),imported:[{...structuredClone(article),paragraphs:structuredClone(paragraphs)}],saved:[article.id]};
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'zh-CN',serviceWorkers:'block',userAgent:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36 ReadSpaceAndroid/1.0.1'});contexts.push(context);
 await context.addInitScript(seed=>{if(!localStorage.getItem('readspace.study.v1'))localStorage.setItem('readspace.study.v1',JSON.stringify(seed));window.translationFetchOptions=[];const original=window.fetch;window.fetch=function(input,options){if(String(input).startsWith('https://api.mymemory.translated.net/'))window.translationFetchOptions.push({credentials:options?.credentials,referrerPolicy:options?.referrerPolicy,cache:options?.cache});return original.call(this,input,options);};},seed);
 const calls=[];
 // Fail closed: a changed endpoint must not turn a mock test into a real disclosure.
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(origin).origin?route.continue():route.abort('blockedbyclient'));
 await context.route('**/api/**',async route=>{
  if(new URL(route.request().url()).pathname==='/api/translate'){
   errors.push('Legacy translation proxy must not be called');return route.abort('blockedbyclient');
  }
  if(route.request().url().includes('/api/account/session'))return route.fulfill({json:{user:null,mailReady:false}});
  return route.fulfill({json:{articles:[],sources:[],status:'fallback'}});
 });
 await context.route('https://api.mymemory.translated.net/**',async route=>{
  const request=route.request(),url=new URL(request.url());assert.equal(url.pathname,'/get');assert.equal(request.method(),'GET');
  const text=url.searchParams.get('q');assert.equal(typeof text,'string');assert.ok(Buffer.byteLength(text,'utf8')<=480);assert.equal(request.headers().cookie,undefined);assert.equal(request.headers().referer,undefined);
  calls.push(text);if(handler)return handler(route,{text},calls.length);
  return officialResponse(route,translations[text]);
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/#read/'+article.id,{waitUntil:'networkidle'});await page.locator('.reading-body').waitFor();
 return{page,context,calls};
}
const panel=page=>page.locator('.article-translation-panel');
async function openFull(page){if(!await page.locator('.translation-controls').isVisible())await page.getByRole('button',{name:'中英对照',exact:true}).click();}
async function startFull(page){await openFull(page);await panel(page).getByRole('button',{name:'开始翻译未完成段落',exact:true}).click();}
async function selectSentence(page,index=1){
 await page.locator('.paragraph-text').nth(index).evaluate(el=>{el.scrollIntoView({block:'center'});const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});
 await page.locator('.selection-bar').waitFor();await page.getByRole('button',{name:'翻译选句',exact:true}).click();
 await page.getByRole('dialog',{name:'选句翻译',exact:true}).waitFor();
}
await mkdir('outputs/qa/translation',{recursive:true});
try{
 {
  const {page,calls}=await setup();await openFull(page);assert.match(await panel(page).textContent(),/MyMemory/);assert.equal(calls.length,0);
  await page.getByRole('button',{name:'中英对照',exact:true}).click();assert.equal(calls.length,0);await startFull(page);
  await until(async()=>(await stored(page)).paragraphs.every(p=>p.zh),'full translation saved');
  assert.deepEqual(calls,article.paragraphs.slice(1).map(p=>p.en));const saved=await stored(page);assert.deepEqual(saved.paragraphs.map(p=>p.en),article.paragraphs.map(p=>p.en));assert.equal(saved.paragraphs[0].zh,article.paragraphs[0].zh);assert.equal(saved.paragraphs[1].translationSource,'MyMemory');assert.ok(validateData(await state(page)));
  assert.deepEqual(await page.evaluate(()=>window.translationFetchOptions),calls.map(()=>({credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'})));
  await page.reload({waitUntil:'networkidle'});assert.deepEqual((await stored(page)).paragraphs,saved.paragraphs);assert.equal(calls.length,2);await openFull(page);assert.equal(calls.length,2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'outputs/qa/translation/full-mobile.png'});
  await page.locator('.paragraph-translation').nth(1).evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:'outputs/qa/translation/paragraphs-mobile.png'});
  console.log('PASS Full translation: explicit disclosure/action, existing translation skipped, original preserved, source and translations persist after reload.');
 }
 {
  let held,release;const gate=new Promise(resolve=>release=resolve);
  const {page,calls}=await setup(async(route,payload,count)=>{if(count===2){held=route;await gate;}await officialResponse(route,translations[payload.text]).catch(()=>{});});
  await startFull(page);await until(()=>!!held,'second paragraph request pending');assert.equal((await stored(page)).paragraphs[1].zh,translations[article.paragraphs[1].en]);
  await page.getByRole('button',{name:'取消文章翻译',exact:true}).click();release();await page.waitForTimeout(200);
  assert.equal((await stored(page)).paragraphs[2].zh,undefined);assert.deepEqual((await stored(page)).paragraphs.map(p=>p.en),article.paragraphs.map(p=>p.en));
  await startFull(page);await until(async()=>!!(await stored(page)).paragraphs[2].zh,'resume after cancellation');assert.deepEqual(calls,[article.paragraphs[1].en,article.paragraphs[2].en,article.paragraphs[2].en]);
  console.log('PASS Cancellation: completed paragraphs remain, late cancelled response cannot write, resume sends only unfinished text.');
 }
 for(const failure of ['server','quota','offline']){
  const {page,calls}=await setup((route)=>failure==='offline'?route.abort('internetdisconnected'):officialResponse(route,'Translation temporarily unavailable',failure==='quota'?429:503));
  await startFull(page);await page.getByRole('button',{name:'重试第 2 段翻译',exact:true}).waitFor();
  assert.ok(calls.length>=1);assert.equal((await stored(page)).paragraphs[1].zh,undefined);assert.deepEqual((await stored(page)).paragraphs.map(p=>p.en),article.paragraphs.map(p=>p.en));
  console.log('PASS '+failure+': translation failure is retryable and never replaces the English text.');
 }
 {
  const {page,calls}=await setup();await selectSentence(page);const dialog=page.getByRole('dialog',{name:'选句翻译',exact:true});assert.match(await dialog.textContent(),/MyMemory/);assert.equal(calls.length,0);
  const back=await readFile('android/app/src/main/assets/native-back.js','utf8');assert.equal(await page.evaluate(back),true);await dialog.waitFor({state:'hidden'});assert.equal(calls.length,0);
  await selectSentence(page);await dialog.getByRole('button',{name:'翻译这句话',exact:true}).click();await dialog.getByRole('button',{name:'保存译文为批注',exact:true}).waitFor();await page.screenshot({path:'outputs/qa/translation/sentence-mobile.png'});await dialog.getByRole('button',{name:'保存译文为批注',exact:true}).click();
  await until(async()=>(await state(page)).notes.length===1,'sentence translation note');const note=(await state(page)).notes[0];assert.equal(note.quote,article.paragraphs[1].en);assert.match(note.text,/阅读帮助我们理解世界/);assert.equal(note.articleId,article.id);assert.equal(note.paragraph,1);assert.equal((await stored(page)).paragraphs[1].zh,undefined);
  await page.reload({waitUntil:'networkidle'});assert.deepEqual((await state(page)).notes[0],note);assert.equal(calls.length,1);
  console.log('PASS Sentence translation: consent action, APK Back closes the dialog, explicit note save and reload preservation.');
 }
 {
  let held,release;const gate=new Promise(resolve=>release=resolve);
  const {page}=await setup(async(route,payload)=>{held=route;await gate;await officialResponse(route,translations[payload.text]).catch(()=>{});});
  await selectSentence(page);const dialog=page.getByRole('dialog',{name:'选句翻译',exact:true});await dialog.getByRole('button',{name:'翻译这句话',exact:true}).click();await until(()=>!!held,'pending sentence request');
  await dialog.getByRole('button',{name:'取消选句翻译',exact:true}).click();release();await page.waitForTimeout(200);assert.equal(await dialog.locator('.sentence-translation-result').count(),0);assert.equal((await state(page)).notes.length,0);assert.deepEqual((await stored(page)).paragraphs.map(p=>p.en),article.paragraphs.map(p=>p.en));
  console.log('PASS Sentence cancellation: late results stay hidden and no note is created.');
 }
 assert.deepEqual(errors,[]);console.log('All translation browser checks passed using mocked translation responses; no real translation text or account writes were sent.');
}catch(error){const page=contexts.at(-1)?.pages().at(-1);if(page)await page.screenshot({path:'outputs/qa/translation/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await Promise.allSettled(contexts.map(context=>context.close()));await browser.close();}
