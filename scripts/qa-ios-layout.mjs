import {chromium} from 'playwright-core';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.QA_URL||'http://127.0.0.1:8793';
const css=await readFile('app/styles/mobile-app.css','utf8');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1';
const ipad='Mozilla/5.0 (iPad; CPU OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1';
try{
 await mkdir('outputs/qa/ios-layout',{recursive:true});
 for(const [width,height,tablet] of [[375,812,false],[390,844,false],[844,390,false],[768,1024,true],[1024,768,true]]){
  const c=await browser.newContext({userAgent:tablet?ipad:iphone,viewport:{width,height},isMobile:true,hasTouch:true});const p=await c.newPage();
  await p.goto(origin+'/#library',{waitUntil:'domcontentloaded'});await p.locator('html[data-platform=ios]').waitFor();await p.locator('.import-button').waitFor();
  if(process.env.QA_INJECT_CSS==='1')await p.addStyleTag({content:css});
  await p.locator('.import-button').click();await p.locator('.modal').waitFor();
  const sizes=await p.locator('.modal input,.modal textarea,.modal select').evaluateAll(els=>els.map(e=>parseFloat(getComputedStyle(e).fontSize)));assert.ok(sizes.length>0);assert.ok(sizes.every(n=>n>=16),`iOS fields too small at ${width}: ${sizes}`);
  await p.getByRole('button',{name:'关闭',exact:true}).click();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
  const blur=await p.locator('.quiet-dock').evaluate(e=>getComputedStyle(e).backdropFilter);if(!tablet)assert.match(blur,/blur/);
  await p.screenshot({path:`outputs/qa/ios-layout/ios-${width}.png`});
  await p.emulateMedia({contrast:'more'});assert.equal(await p.locator('.quiet-dock').evaluate(e=>getComputedStyle(e).backdropFilter),'none');await p.emulateMedia({contrast:'no-preference'});
  const session=await c.newCDPSession(p);await session.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
  if(await p.evaluate(()=>matchMedia('(prefers-reduced-transparency:reduce)').matches))assert.equal(await p.locator('.quiet-dock').evaluate(e=>getComputedStyle(e).backdropFilter),'none');
  await session.send('Emulation.setEmulatedMedia',{features:[]});await session.detach();
  // Chromium has zero physical safe-area insets. Substitute only env() calls
  // with fixed test values to check inset arithmetic, not Safari hardware behavior.
  const insets={'top':'24px','left':'44px','right':'44px','bottom':'21px'};
  await p.addStyleTag({content:css.replace(/env\(safe-area-inset-(top|left|right|bottom)\)/g,(_,edge)=>insets[edge])});
  const padding=await p.locator('body').evaluate(e=>{const s=getComputedStyle(e);return[s.paddingTop,s.paddingLeft,s.paddingRight];});assert.deepEqual(padding,['24px','44px','44px']);
  if(!tablet){const rect=await p.locator('.quiet-dock').boundingBox();assert.ok(rect.x>=44&&rect.x+rect.width<=width-44+.5);}
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'inset overflow '+width);
  await c.close();console.log(`PASS iOS ${width}x${height}: 16px fields, layout, safe-area arithmetic${tablet?', preserved tablet layout':', glass navigation'}`);
 }
 const c=await browser.newContext({viewport:{width:1440,height:900}}),p=await c.newPage();await p.goto(origin+'/#home');await p.locator('html[data-platform=desktop]').waitFor();
 const before=await p.locator('.quiet-dock').evaluate(e=>{const s=getComputedStyle(e);return[s.borderRadius,s.width,s.backdropFilter];});await p.addStyleTag({content:css});const after=await p.locator('.quiet-dock').evaluate(e=>{const s=getComputedStyle(e);return[s.borderRadius,s.width,s.backdropFilter];});assert.deepEqual(after,before);await c.close();
 console.log('PASS desktop navigation unchanged. Chromium emulation and injected insets do not replace physical Safari keyboard, notch or standalone tests.');
}finally{await browser.close();}
