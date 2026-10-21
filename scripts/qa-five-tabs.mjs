import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {defaultData,validateData} from '../lib/reading.ts';
const origin=process.env.QA_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],log=[],test=async(name,fn)=>{await fn();log.push(name);console.log('PASS '+name);};
const fixture={...structuredClone(defaultData),saved:['green-spaces'],words:[
 {id:'commit',word:'commit',phonetic:'/kəˈmɪt/',pos:'v.',meaning:'承诺；投入',sentence:'We commit to a little reading every day.',articleId:'green-spaces',articleTitle:'The Quiet Power of Green Spaces',addedAt:'2026-10-19T10:00:00Z',mastered:false},
 {id:'benefit',word:'benefit',phonetic:'/ˈbenɪfɪt/',pos:'n.',meaning:'利益；好处',sentence:'The benefit of reading stays with us.',articleId:'green-spaces',articleTitle:'The Quiet Power of Green Spaces',addedAt:'2026-10-18T10:00:00Z',mastered:false},
 {id:'share',word:'share',phonetic:'/ʃeə/',pos:'n.',meaning:'份额',sentence:'We share our ideas.',articleId:'green-spaces',articleTitle:'The Quiet Power of Green Spaces',addedAt:'2026-10-17T10:00:00Z',mastered:true}],notes:[
 {id:'sentence-1',articleId:'green-spaces',paragraph:0,quote:'A quiet place gives us room to think.',text:'安静的空间有助于思考。',addedAt:'2026-10-19T10:00:00Z'},
 {id:'sentence-2',articleId:'green-spaces',paragraph:1,quote:'Small habits can make a lasting difference.',text:'小习惯，也能带来长远改变。',addedAt:'2026-10-18T10:00:00Z'}],records:{'green-spaces':{progress:35,seconds:180,lastReadAt:'2026-10-19T10:00:00Z'}}};
const external={id:'qa-source',title:'A public article about learning',subtitle:'Science News',source:'Science News',sourceUrl:'https://www.sciencenews.org/article/learning',topic:'科技与学习',level:3,kind:'external',image:'/images/study.jpg',paragraphs:[],description:'真实来源的公开文章。'};
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('readspace.study.v1')||'null'));
const nav=(p,title)=>p.locator('.quiet-dock').getByRole('button',{name:new RegExp('^'+title+' ')});
async function setup(seed=fixture,hash=''){
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'zh-CN',reducedMotion:'reduce'});
 await c.addInitScript(value=>{if(!localStorage.getItem('readspace.study.v1'))localStorage.setItem('readspace.study.v1',JSON.stringify(value));},seed);
 const p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/discover*',r=>r.fulfill({json:{articles:[external],status:'live',sources:[],checkedAt:new Date().toISOString()}}));
 await p.goto(origin+'/'+hash,{waitUntil:'networkidle'});return{c,p};
}
await mkdir('outputs/qa/five-tabs',{recursive:true});
const {c,p}=await setup();
try{
 await test('The homepage contains only the resume entry and sourced quotations with exactly five destinations',async()=>{
  assert.equal(await p.locator('h1').textContent(),'首页');assert.equal(await p.locator('.quiet-dock>button').count(),5);assert.equal(await p.locator('.quiet-article-row,.profile-stats,input').count(),0);
  assert.match(await p.locator('.home-resume').textContent(),/35%/);const before=await p.locator('.home-quote blockquote').textContent();await p.getByRole('button',{name:'换一句',exact:true}).click();assert.notEqual(await p.locator('.home-quote blockquote').textContent(),before);assert.match(await p.locator('.home-quote>a').getAttribute('href'),/^https:/);
  assert.deepEqual(await state(p),fixture);await p.screenshot({path:'outputs/qa/five-tabs/home-mobile.png'});
 });
 await test('The library places saved articles first and includes training, source and imported articles with functioning filters',async()=>{
  await nav(p,'图书馆').click();await p.getByText(external.title,{exact:true}).waitFor();assert.equal(await p.locator('.bookshelf .shelf-book').count(),1);
  assert.ok(await p.locator('.bookshelf').evaluate(el=>el.getBoundingClientRect().top)<await p.locator('.all-articles').evaluate(el=>el.getBoundingClientRect().top));
  await p.getByRole('button',{name:'四六级训练',exact:true}).click();assert.equal(await p.locator('.quiet-article-row').count(),6);
  await p.locator('.quiet-filters>summary').click();for(const length of ['short','medium','long']){await p.getByLabel('预计阅读',{exact:true}).selectOption(length);assert.equal(await p.locator('.quiet-article-row').count(),2);}await p.getByLabel('预计阅读',{exact:true}).selectOption('all');await p.locator('.quiet-filters>summary').click();
  await p.getByRole('button',{name:/^收藏 /}).first().click();assert.equal((await state(p)).saved.length,2);await p.reload({waitUntil:'networkidle'});assert.equal(await p.locator('.shelf-book').count(),2);await p.screenshot({path:'outputs/qa/five-tabs/library-mobile.png'});
 });
 await test('The notebook preserves old words and sentences and supports editing meanings, understanding and mastery',async()=>{
  await nav(p,'词句本').click();assert.equal(await p.locator('.notebook-word').count(),3);assert.match(await p.locator('.notebook-word').first().textContent(),/commit/);await p.screenshot({path:'outputs/qa/five-tabs/notebook-mobile.png'});
  await p.locator('.notebook-word').first().locator('summary').click();await p.getByRole('button',{name:'编辑释义',exact:true}).first().click();await p.getByLabel('我的释义',{exact:true}).fill('承诺；致力于');await p.getByRole('button',{name:'保存',exact:true}).click();assert.equal((await state(p)).words[0].meaning,'承诺；致力于');
  await p.getByRole('tab',{name:/句子/}).click();assert.equal(await p.locator('.notebook-sentence').count(),2);await p.getByRole('button',{name:'编辑批注',exact:true}).first().click();await p.getByLabel('我的理解',{exact:true}).fill('保留我自己的理解');await p.getByRole('button',{name:'保存',exact:true}).click();assert.equal((await state(p)).notes[0].text,'保留我自己的理解');await p.screenshot({path:'outputs/qa/five-tabs/sentences-mobile.png'});
 });
 await test('Word and sentence review update separate mastery and persist real weekly activity without resetting reading data',async()=>{
  await nav(p,'复习').click();assert.match(await p.locator('.review-count').textContent(),/2/);assert.match(await p.locator('.review-week').textContent(),/已复习 0 天/);await p.screenshot({path:'outputs/qa/five-tabs/review-mobile.png'});
  await p.getByRole('button',{name:'开始复习',exact:true}).click();await p.getByRole('button',{name:'查看释义',exact:true}).click();await p.getByRole('button',{name:'我记住了',exact:true}).click();await p.getByRole('button',{name:'查看释义',exact:true}).click();await p.getByRole('button',{name:'还需巩固',exact:true}).click();await p.locator('.review-finish').waitFor();
  let d=await state(p);assert.equal(d.words.find(w=>w.id==='commit').mastered,true);assert.equal(d.words.find(w=>w.id==='benefit').mastered,false);assert.equal(d.review.days.length,1);assert.deepEqual(d.records,fixture.records);assert.deepEqual(d.notes.map(n=>n.quote),fixture.notes.map(n=>n.quote));
  await p.getByRole('button',{name:'返回复习',exact:true}).click();await p.getByRole('button',{name:/句子复习/}).click();await p.getByRole('button',{name:'查看我的理解',exact:true}).click();assert.match(await p.locator('.revealed-meaning').textContent(),/保留我自己的理解/);await p.getByRole('button',{name:'我记住了',exact:true}).click();await p.getByRole('button',{name:'结束本次',exact:true}).click();assert.match(await p.locator('.review-sentence-entry').textContent(),/1 句待复习/);await p.reload({waitUntil:'networkidle'});assert.match(await p.locator('.review-week').textContent(),/已复习 1 天/);d=await state(p);assert.ok(validateData(d));assert.equal(d.review.sentences['sentence-1'].mastered,true);
 });
 await test('My space exports complete backups and vocabulary, rejects invalid backups and restores old records compatibly',async()=>{
  await nav(p,'我的').click();assert.equal(await p.locator('.profile-stats>div').count(),4);const before=await state(p);
  const event=p.waitForEvent('download');await p.getByRole('button',{name:'导出备份',exact:true}).click();const file=await event;await file.saveAs('outputs/qa/five-tabs/backup.json');assert.deepEqual(JSON.parse(await readFile('outputs/qa/five-tabs/backup.json','utf8')),before);
  const csv=p.waitForEvent('download');await p.getByRole('button',{name:/^导出生词/}).click();const csvFile=await csv;await csvFile.saveAs("outputs/qa/five-tabs/words.csv");assert.match(await readFile("outputs/qa/five-tabs/words.csv","utf8"),/commit/);const md=p.waitForEvent("download");await p.getByRole("button",{name:/^导出句子与批注/}).click();await (await md).saveAs("outputs/qa/five-tabs/sentences.md");assert.match(await readFile("outputs/qa/five-tabs/sentences.md","utf8"),/保留我自己的理解/);
  await p.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1}')});assert.match(await p.locator('.form-error').textContent(),/不是有效/);assert.deepEqual(await state(p),before);
  await p.locator('input[type=file]').setInputFiles({name:'old-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await p.getByRole('button',{name:'确认恢复',exact:true}).click();assert.deepEqual(await state(p),fixture);await p.screenshot({path:'outputs/qa/five-tabs/profile-mobile.png'});
 });
 await test('The reader retains lookup, progressive help, annotations and mobile reading settings',async()=>{
  await nav(p,'首页').click();await p.getByRole('button',{name:'接着读',exact:true}).click();await p.locator('.reading-body').waitFor();assert.equal(await p.locator('.quiet-dock').count(),0);
  await p.getByRole('button',{name:'查词 attention',exact:true}).first().click();await p.getByRole('dialog').waitFor();assert.match(await p.locator('.lookup-meaning').textContent(),/注意力/);await p.getByRole('button',{name:'收藏单词与原句',exact:true}).click();await p.getByRole('button',{name:'关闭',exact:true}).click();assert.ok((await state(p)).words.some(w=>w.word==='attention'));
  await p.getByRole('button',{name:'第 1 段阅读辅助',exact:true}).click();await p.getByRole('button',{name:'还需要帮助？展开结构解析'}).click();await p.getByRole('button',{name:'还需要帮助？看看中文翻译'}).click();assert.match(await p.locator('.translation').textContent(),/繁忙的大学校园/);await p.getByRole('button',{name:'关闭阅读辅助',exact:true}).click();
  await p.locator('.paragraph-text').first().evaluate(el=>{el.scrollIntoView({block:'center'});const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});await p.locator('.selection-bar').waitFor();await p.getByRole('button',{name:'批注',exact:true}).click();await p.getByLabel('我的理解',{exact:true}).fill('新版手机阅读批注');await p.getByRole('button',{name:'保存批注与高亮',exact:true}).click();assert.ok((await state(p)).notes.some(n=>n.text==='新版手机阅读批注'));
  await p.getByRole('button',{name:'返回图书馆',exact:true}).click();await nav(p,'词句本').click();await p.getByRole('tab',{name:/句子/}).click();assert.match(await p.locator('.notebook-list').textContent(),/新版手机阅读批注/);
 });
 await test('Every destination fits 320px, 390px, 768px and desktop widths with accessible five-button navigation',async()=>{
  for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:width>=768?1000:844});for(const title of ['首页','图书馆','词句本','复习','我的']){await nav(p,title).click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${title} at ${width}`);assert.equal(await p.locator('.quiet-dock [aria-current=page]').count(),1);}if(width>=768)await p.screenshot({path:`outputs/qa/five-tabs/profile-${width}.png`});}
 });
 await test('First use shows honest zero counts and useful empty states without creating study records',async()=>{
  const fresh=await setup(structuredClone(defaultData),'#review');assert.equal(await fresh.p.locator('.review-count strong').textContent(),'0');assert.equal(await fresh.p.getByRole('button',{name:'开始复习',exact:true}).isDisabled(),true);assert.match(await fresh.p.locator('.review-week').textContent(),/已复习 0 天/);await nav(fresh.p,'词句本').click();assert.match(await fresh.p.locator('.quiet-empty').textContent(),/把新词/);assert.deepEqual(await state(fresh.p),defaultData);await fresh.c.close();
 });
 assert.deepEqual(errors,[]);console.log(`All ${log.length} five-tab checks passed; no browser exceptions.`);
}catch(e){await p.screenshot({path:'outputs/qa/five-tabs/failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
