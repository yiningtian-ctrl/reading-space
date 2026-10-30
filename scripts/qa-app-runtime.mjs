import {chromium} from 'playwright-core';import assert from 'node:assert/strict';
const origin=process.env.QA_URL||'http://127.0.0.1:8793';
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const context=await browser.newContext({userAgent:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',viewport:{width:390,height:844},isMobile:true});
 const page=await context.newPage();await page.addInitScript(()=>{const register=navigator.serviceWorker.register.bind(navigator.serviceWorker);navigator.serviceWorker.register=async(...args)=>{const r=await register(...args);window.testRegistration=r;return r;};});
 await page.goto(origin+'/#home');await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:30000});
 await page.evaluate(()=>{const e=new Event('beforeinstallprompt');e.prompt=async()=>{window.installRequested=true;};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);});
 const profile=()=>page.locator('.quiet-dock').getByRole('button',{name:/我的/}).click();const home=()=>page.locator('.quiet-dock').getByRole('button',{name:/首页/}).click();
 await profile();await page.getByRole('button',{name:'安装 ReadSpace',exact:true}).waitFor();await home();await profile();await page.getByRole('button',{name:'安装 ReadSpace',exact:true}).click();assert.equal(await page.evaluate(()=>window.installRequested),true);
 await home();await page.evaluate(()=>{const reg=window.testRegistration,worker=new EventTarget();worker.state='installing';worker.postMessage=data=>{window.updateRequested=data;};Object.defineProperty(reg,'installing',{value:worker});Object.defineProperty(reg,'waiting',{value:worker});reg.dispatchEvent(new Event('updatefound'));worker.state='installed';worker.dispatchEvent(new Event('statechange'));});await profile();await page.getByRole('button',{name:'更新应用',exact:true}).waitFor();await home();await profile();await page.getByRole('button',{name:'更新应用',exact:true}).click();assert.equal(await page.evaluate(()=>window.updateRequested),'ACTIVATE_UPDATE');
 await home();await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'首页',exact:true}).waitFor();await context.setOffline(false);await context.close();
 console.log('PASS first-home offline preparation, install prompt persistence, update detection across tabs and offline reopen.');
 const native=await browser.newContext({userAgent:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36 ReadSpaceAndroid/1.0.1'});const p=await native.newPage();await p.goto(origin+'/#profile');await p.getByText('已在独立应用窗口中打开。',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'安装 ReadSpace',exact:true}).count(),0);await native.close();console.log('PASS APK user agent is recognized as installed.');
}finally{await browser.close();}
