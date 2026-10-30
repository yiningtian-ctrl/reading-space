import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaultData} from '../lib/reading.ts';
const origin=process.env.QA_URL||'http://127.0.0.1:8793';
const article={id:'translation-mobile-fixture',title:'A garden for curious readers',subtitle:'Synthetic mobile QA text',topic:'校园与成长',level:2,source:'个人导入',kind:'imported',image:'/images/study.jpg',description:'Synthetic QA fixture, not a user article.',paragraphs:[{en:'A quiet garden gives students a place to think. Reading slowly can help us notice new ideas.'},{en:'Our campus library welcomes curious readers. A shared book may start a thoughtful conversation.'}]};
const translated=text=>text.startsWith('A quiet')?'安静的花园给学生一个思考的地方。':'校园图书馆欢迎好奇的读者。';
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1';
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('readspace.study.v1')));
async function selectSentence(p){return p.locator('.paragraph-text').first().evaluate(el=>{el.scrollIntoView({block:'center'});const text=el.textContent,limit=text.indexOf('.')+1,walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),range=document.createRange();let node,used=0,started=false;while(node=walker.nextNode()){if(!started){range.setStart(node,0);started=true;}if(used+node.textContent.length>=limit){range.setEnd(node,limit-used);break;}used+=node.textContent.length;}const s=window.getSelection();s.removeAllRanges();s.addRange(range);document.dispatchEvent(new Event('selectionchange'));return s.toString();});}
const fits=async(p,selector)=>{const r=await p.locator(selector).first().boundingBox(),{width:w,height:h}=p.viewportSize();assert.ok(r&&r.x>=-.5&&r.x+r.width<=w+.5,selector+' overflow');if(selector!=='.paragraph-translation')assert.ok(r.y>=-.5&&r.y+r.height<=h+.5,selector+' clipped vertically');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');};
const luminance=rgb=>rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const readable=(ink,paper)=>{const [a,b]=[luminance(ink),luminance(paper)].sort((a,b)=>b-a);assert.ok((a+.05)/(b+.05)>=4.5,`Translation contrast below 4.5:1: ${ink} on ${paper}`);};
try{
 await mkdir('outputs/qa/translation-mobile',{recursive:true});
 for(const [width,height,background]of [[320,760,'paper'],[390,844,'night'],[844,390,'paper']]){
  const c=await browser.newContext({userAgent:ua,viewport:{width,height},isMobile:true,hasTouch:true,serviceWorkers:'block'}),p=await c.newPage();p.setDefaultTimeout(12000);const errors=[],requests=[];let failSecond=true,mode='normal',release,holdStarted,dictRequests=0;
  p.on('pageerror',e=>errors.push(e.message));
  await c.addInitScript(d=>{if(!localStorage.getItem('readspace.study.v1'))localStorage.setItem('readspace.study.v1',JSON.stringify(d));},{...structuredClone(defaultData),settings:{...defaultData.settings,background},imported:[article],saved:[article.id]});
  await p.route('**/api/dictionary?**',r=>{dictRequests++;return r.fulfill({json:{meaning:'模拟释义',pos:'n.',english:[],englishStatus:'not-found'}});});
  await p.route('https://api.mymemory.translated.net/**',async r=>{const text=new URL(r.request().url()).searchParams.get('q');assert.ok(text&&article.paragraphs.some(x=>x.en.includes(text)),'Only synthetic fixture may be translated');requests.push(text);const held=mode==='hold';if(held)await new Promise(resolve=>{release=resolve;holdStarted?.();});try{if(text===article.paragraphs[1].en&&failSecond){failSecond=false;await r.fulfill({status:503,headers:{'access-control-allow-origin':'*'},json:{responseStatus:503}});}else await r.fulfill({headers:{'access-control-allow-origin':'*'},json:{responseStatus:200,quotaFinished:false,responseData:{translatedText:translated(text)}}});}catch(e){if(!held)throw e;}});
  await p.goto(origin+'/#read/'+article.id,{waitUntil:'domcontentloaded'});await p.locator('.reading-word').first().waitFor();assert.equal(requests.length,0);
  const quote=await selectSentence(p);await p.locator('.selection-bar').waitFor();
  await p.locator('.reading-word').first().evaluate(el=>el.click());assert.equal(await p.getByRole('dialog').count(),0);assert.equal(dictRequests,0,'Active text selection must not open dictionary');await fits(p,'.selection-bar');
  await p.screenshot({path:`outputs/qa/translation-mobile/selection-${width}.png`});
  await p.getByRole('button',{name:'翻译选句',exact:true}).click();const dialog=p.getByRole('dialog',{name:'选句翻译',exact:true});await dialog.waitFor();assert.match(await dialog.textContent(),/MyMemory/);assert.equal(requests.length,0,'Opening sentence dialog must not send text');await fits(p,'.modal');
  await p.keyboard.press('Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,'Modal traps focus');
  await p.getByRole('button',{name:'翻译这句话',exact:true}).click();await p.getByRole('button',{name:'保存译文为批注',exact:true}).waitFor();assert.equal(requests[0],quote);
  const modalColors=await dialog.evaluate(el=>[getComputedStyle(el.querySelector('.sentence-translation-result>p')).color,getComputedStyle(el).backgroundColor]);readable(...modalColors);
  const quoteColors=await dialog.locator('.preview-quote').evaluate(el=>[getComputedStyle(el).color,getComputedStyle(el).backgroundColor]);readable(...quoteColors);await p.screenshot({path:`outputs/qa/translation-mobile/sentence-${width}.png`});
  await p.getByRole('button',{name:'保存译文为批注',exact:true}).click();
  await p.waitForFunction(q=>JSON.parse(localStorage.getItem('readspace.study.v1')).notes.some(n=>n.quote===q&&n.text.includes('安静的花园')),quote);
  if(await p.getByRole('dialog').count())await p.keyboard.press('Escape');await p.evaluate(()=>window.getSelection()?.removeAllRanges());
  await p.getByRole('button',{name:'中英对照',exact:true}).click();await p.locator('.article-translation-panel').waitFor();assert.match(await p.locator('.article-translation-panel').textContent(),/MyMemory/);assert.equal(requests.length,1);
  if(width===320){mode='hold';const started=new Promise(resolve=>{holdStarted=resolve;});await p.getByRole('button',{name:'开始翻译未完成段落',exact:true}).click();await started;await p.getByRole('button',{name:'取消文章翻译',exact:true}).click();release();await p.waitForTimeout(80);assert.equal((await state(p)).imported[0].paragraphs.some(x=>x.zh),false,'Cancelled late translation must not be saved');mode='normal';}
  const firstParagraphRequests=requests.filter(t=>t===article.paragraphs[0].en).length;
  await p.getByRole('button',{name:'开始翻译未完成段落',exact:true}).click();await p.getByRole('button',{name:'重试第 2 段翻译',exact:true}).waitFor();
  assert.equal((await state(p)).imported[0].paragraphs[0].zh,translated(article.paragraphs[0].en));assert.equal((await state(p)).imported[0].paragraphs[1].zh,undefined);
  await p.getByRole('button',{name:'重试第 2 段翻译',exact:true}).click();await p.waitForFunction(()=>!!JSON.parse(localStorage.getItem('readspace.study.v1')).imported[0].paragraphs[1].zh);
  assert.equal(requests.filter(t=>t===article.paragraphs[0].en).length,firstParagraphRequests+1,'Retry must not resend finished paragraph');
  await p.locator('.paragraph-translation').first().scrollIntoViewIfNeeded();await fits(p,'.paragraph-translation');await p.screenshot({path:`outputs/qa/translation-mobile/translation-${width}.png`});
  const paragraphColors=await p.locator('.paragraph-translation').first().evaluate(el=>[getComputedStyle(el.querySelector('p')).color,getComputedStyle(el.closest('.reader')).backgroundColor]);readable(...paragraphColors);
  await p.reload({waitUntil:'domcontentloaded'});await p.locator('.reading-word').first().waitFor();assert.equal((await state(p)).imported[0].paragraphs.filter(x=>x.zh).length,2,'Full translation persists');assert.equal((await state(p)).notes[0].quote,quote);
  // A layout viewport reduction checks constrained-space focus/layout only; it
  // cannot reproduce Safari's native keyboard or selection handles.
  await p.setViewportSize({width,height:Math.min(height,420)});await selectSentence(p);await p.locator('.selection-bar').waitFor();await p.getByRole('button',{name:'批注',exact:true}).click();await p.getByLabel('我的理解',{exact:true}).fill('移动端输入检查');assert.equal(await p.locator('.modal textarea').evaluate(el=>getComputedStyle(el).fontSize),'16px');await fits(p,'.modal');await p.keyboard.press('Escape');
  assert.deepEqual(errors,[]);await c.close();console.log(`PASS mobile translation ${width}x${height}: selection, explicit disclosure, saved sentence, full translation/retry, persistence, layout and 16px input${width===320?', cancellation':''}.`);
 }
 console.log('Chromium range/touch emulation does not replace real Safari long-press, keyboard, handles or standalone testing. All translation calls used synthetic text and local mocks.');
}finally{await browser.close();}
