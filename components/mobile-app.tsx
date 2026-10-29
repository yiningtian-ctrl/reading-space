"use client";
import {useEffect,useState} from 'react';
type Prompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export function MobilePlatform(){useEffect(()=>{document.documentElement.dataset.platform=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':/Android/.test(navigator.userAgent)?'android':'desktop';},[]);return null;}
export default function MobileApp(){
 const [platform,setPlatform]=useState('desktop'),[installed,setInstalled]=useState(false),[prompt,setPrompt]=useState<Prompt|null>(null),[update,setUpdate]=useState<ServiceWorker|null>(null),[status,setStatus]=useState('');
 useEffect(()=>{
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),os=ios?'ios':/Android/.test(navigator.userAgent)?'android':'desktop';
  setPlatform(os);document.documentElement.dataset.platform=os;
  const media=matchMedia('(display-mode: standalone)'),standalone=()=>setInstalled(media.matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);standalone();media.addEventListener('change',standalone);
  const before=(event:Event)=>{event.preventDefault();setPrompt(event as Prompt);};window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',standalone);
  let disposed=false;const cleanups:Array<()=>void>=[];
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
   if(disposed)return;if(reg.waiting)setUpdate(reg.waiting);
   const found=()=>{const worker=reg.installing;if(!worker)return;const changed=()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)setUpdate(reg.waiting||worker);};worker.addEventListener('statechange',changed);cleanups.push(()=>worker.removeEventListener('statechange',changed));};
   reg.addEventListener('updatefound',found);cleanups.push(()=>reg.removeEventListener('updatefound',found));
  }).catch(()=>{if(!disposed)setStatus('离线资源准备失败，联网阅读仍可使用。');});
  return()=>{disposed=true;media.removeEventListener('change',standalone);window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',standalone);cleanups.forEach(fn=>fn());};
 },[]);
 const install=async()=>{if(!prompt)return;await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setStatus('安装请求已确认，请按系统提示完成。');setPrompt(null);};
 const refresh=()=>{if(!update)return;setStatus('正在更新应用…');navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});update.postMessage('ACTIVATE_UPDATE');};
 return <section className="mobile-install" aria-labelledby="install-heading"><div><h2 id="install-heading">把 ReadSpace 放进口袋</h2><p>{installed?'已在独立应用窗口中打开。':'安装到主屏幕，从应用图标继续阅读。'}</p><span>{platform==='ios'?'为 iPhone 与 iPad 优化':platform==='android'?'为 Android 优化':'iPhone 与 Android 均可安装'}</span></div><div className="mobile-install-help">{!installed&&(prompt?<button className="button primary" onClick={()=>void install()}>安装 ReadSpace</button>:<p>{platform==='ios'?'在 Safari 中点击“分享”，选择“添加到主屏幕”，确认作为网页 App 打开。':platform==='android'?'在 Chrome 的菜单中选择“安装应用”或“添加到主屏幕”。':'手机打开这个网址，再使用浏览器菜单中的“添加到主屏幕”或“安装应用”。'}</p>)}<p>首次联网打开后会准备离线资源。已下载的文章与本机词句可离线阅读；查词补充、验证码和云端同步需要联网。</p>{update&&<div><p>有新版本。请先保存正在编辑的内容，再更新。</p><button className="button" onClick={refresh}>更新应用</button></div>}{status&&<p role="status">{status}</p>}</div></section>;
}
