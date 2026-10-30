"use client";
import {useEffect,useSyncExternalStore} from 'react';
type Prompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
const initial={platform:'desktop',installed:false,prompt:null as Prompt|null,update:null as ServiceWorker|null,status:''};
let runtime=initial;
const listeners=new Set<()=>void>();
const publish=(patch:Partial<typeof initial>)=>{runtime={...runtime,...patch};listeners.forEach(fn=>fn());};
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
// Mounted once in the shell: installation and offline preparation do not depend
// on visiting the account page, and their state survives tab navigation.
export function MobilePlatform(){
 useEffect(()=>{
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),os=ios?'ios':/Android/.test(navigator.userAgent)?'android':'desktop';
  publish({platform:os});document.documentElement.dataset.platform=os;
  const media=matchMedia('(display-mode: standalone)'),standalone=()=>publish({installed:media.matches||!!(navigator as Navigator&{standalone?:boolean}).standalone||/ReadSpaceAndroid\//.test(navigator.userAgent)});standalone();media.addEventListener('change',standalone);
  const before=(event:Event)=>{event.preventDefault();publish({prompt:event as Prompt});};
  const installed=()=>publish({installed:true,prompt:null});window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',installed);
  let disposed=false;const cleanups:Array<()=>void>=[];
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
   if(disposed)return;if(reg.active)publish({status:'离线资源已准备好，本机已保存的内容可断网阅读。'});if(reg.waiting)publish({update:reg.waiting});
   const found=()=>{const worker=reg.installing;if(!worker)return;const changed=()=>{if(worker.state==='installed'){publish(navigator.serviceWorker.controller?{update:reg.waiting||worker}:{status:'离线资源已准备好，本机已保存的内容可断网阅读。'});}else if(worker.state==='redundant'&&!reg.active)publish({status:'离线资源准备失败，请联网后重新打开应用。'});};worker.addEventListener('statechange',changed);cleanups.push(()=>worker.removeEventListener('statechange',changed));changed();};
   reg.addEventListener('updatefound',found);cleanups.push(()=>reg.removeEventListener('updatefound',found));
   if(reg.installing)found();
  }).catch(()=>{if(!disposed)publish({status:'离线资源准备失败，联网阅读仍可使用。'});});
  return()=>{disposed=true;media.removeEventListener('change',standalone);window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',installed);cleanups.forEach(fn=>fn());};
 },[]);
 return null;
}
export default function MobileApp(){
 const {platform,installed,prompt,update,status}=useSyncExternalStore(subscribe,()=>runtime,()=>initial);
 const install=async()=>{if(!prompt)return;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')publish({status:'安装请求已确认，请按系统提示完成。'});}catch{publish({status:'请使用浏览器菜单安装 ReadSpace。'});}finally{publish({prompt:null});}};
 const refresh=()=>{if(!update)return;publish({status:'正在更新应用…',update:null});navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});update.postMessage('ACTIVATE_UPDATE');};
 return <section className="mobile-install" aria-labelledby="install-heading">
  <div className="mobile-install-intro"><h2 id="install-heading">把 ReadSpace 放进口袋</h2><p>{installed?'已在独立应用窗口中打开。':'安装到主屏幕，从应用图标继续阅读。'}</p><span>{platform==='ios'?'为 iPhone 与 iPad 优化':platform==='android'?'为 Android 优化':'iPhone 与 Android 均可安装'}</span></div>
  <div className="mobile-install-help">
   {!installed&&(prompt?<button className="button primary" onClick={()=>void install()}>安装 ReadSpace</button>:<p>{platform==='ios'?'在 Safari 中点击“分享”，选择“添加到主屏幕”，确认作为网页 App 打开。':platform==='android'?'在 Chrome 的菜单中选择“安装应用”或“添加到主屏幕”。':'手机打开这个网址，再使用浏览器菜单中的“添加到主屏幕”或“安装应用”。'}</p>)}
   {!installed&&<p>首次联网打开后会准备离线资源。已下载的文章与本机词句可离线阅读；查词补充、验证码和云端同步需要联网。</p>}
   {update&&<div><p>有新版本。请先保存正在编辑的内容，再更新。</p><button className="button" onClick={refresh}>更新应用</button></div>}
   {status&&<p role="status">{status}</p>}
  </div>
 </section>;
}
