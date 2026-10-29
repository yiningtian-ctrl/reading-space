"use client";
import EmailVerification from './email-verification';

import {useEffect,useState} from 'react';
import type {RefObject} from 'react';
import {Cloud,CloudOff,LoaderCircle} from 'lucide-react';
import type {AccountState,StudySync} from '@/lib/study-sync-client';

export const syncLabels={checking:'正在检查登录',local:'仅本机',syncing:'正在同步',synced:'已同步',pending:'等待同步',offline:'离线 · 本机已保存',conflict:'需要处理冲突',expired:'请重新登录','email-required':'请先绑定邮箱'};
function download(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function AccountPanel({state,controller}:{state:AccountState;controller:RefObject<StudySync|null>}){
  const [mode,setMode]=useState<'email'|'login'|'register'|'recover'>('email'),[username,setUsername]=useState(state.user?.username||''),[password,setPassword]=useState(''),[code,setCode]=useState(''),[error,setError]=useState(''),[proof,setProof]=useState({email:'',code:'',challengeId:''});
  useEffect(()=>{setUsername(state.user?.username||'');setPassword('');setCode('');setError('');},[state.user?.id]);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');try{await controller.current?.authenticate(mode==='email'?'email/login':mode,username,password,code,proof);setPassword('');setCode('');}catch(e){setError(e instanceof Error?e.message:'登录失败，请重试。');}};
  const user=state.user,showForm=!user||state.authRequired,binding=!!user&&!user.email&&!state.authRequired;
  return <section className="account-section" aria-labelledby="account-title">
    <div className="account-intro"><h2 id="account-title">账号与云端同步</h2><p>把你的阅读积累，带到下一台设备。</p><p className="account-scope">收藏、词句、导入文章和阅读记录，随账号保存。</p></div>
    <div className="account-controls">
      <div className="account-status" role="status">{state.status==='syncing'||state.status==='checking'?<LoaderCircle size={18} className="spin"/>:state.status==='offline'?<CloudOff size={18}/>:<Cloud size={18}/>}<div><strong>{user?user.username:'未登录'}</strong><span>{syncLabels[state.status]}{state.lastSynced&&` · 上次 ${new Date(state.lastSynced).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`}</span></div></div>
      {state.available===false&&<p className="account-error" role="alert">云端账号尚未就绪。网站管理员需完成云数据库配置；你仍可在本机阅读和导出备份。<button type="button" className="text-button" onClick={()=>void controller.current?.refresh()}>重新检查</button></p>}
      {state.mailReady===false&&<p role="alert" className="account-error">邮件服务尚未配置，请联系管理员。</p>}
      {user?.email&&<p className="account-footnote">已验证邮箱：{user.email}</p>}
      {binding&&<form className="account-form" onSubmit={async e=>{e.preventDefault();setError('');try{await controller.current?.authenticate('email/bind','','','',proof);}catch(e){setError(e instanceof Error?e.message:'绑定失败');}}}><h3>为旧账号验证并绑定邮箱</h3><p>原有学习数据保留，验证后继续同步。一个邮箱只能绑定一个账号。</p><EmailVerification sync={controller.current} purpose="bind" ready={state.mailReady} onProof={setProof}/>{error&&<p className="account-error" role="alert">{error}</p>}<button className="button primary" type="submit" disabled={state.authBusy}>验证并绑定邮箱</button><button className="text-button" type="button" onClick={()=>void controller.current?.logout().catch(()=>{})}>退出登录</button></form>}
      {state.recoveryCode&&<div className="account-recovery"><h3>请保存账号恢复码</h3><p>忘记密码时凭它重设密码。重设后旧恢复码和所有旧登录会失效。请单独保存，不要发给他人。</p><code>{state.recoveryCode}</code><div className="account-actions"><button className="button" onClick={()=>download('readspace-account-recovery.json',JSON.stringify({username:user?.username,recoveryCode:state.recoveryCode},null,2))}>下载恢复码</button><button className="text-button" onClick={()=>controller.current?.clearRecovery()}>我已保存</button></div></div>}
      {showForm&&<><div className="account-tabs" aria-label="账号操作">{([['email','邮箱登录'],['login','密码登录'],['register','注册'],['recover','找回密码']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>{setMode(value);setPassword('');setCode('');setError('');}}>{label}</button>)}</div><form onSubmit={submit} className="account-form">
        {mode!=='email'&&<><label htmlFor="account-username">用户名<input id="account-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" value={username} onChange={e=>setUsername(e.target.value)} aria-describedby="username-help"/></label><small id="username-help">3–32 位英文字母、数字或下划线，不区分大小写。</small></>}
        {mode==='recover'&&<label htmlFor="account-code">账号恢复码<input id="account-code" name="recoveryCode" autoComplete="off" required pattern="[a-f0-9]{64}" value={code} onChange={e=>setCode(e.target.value.trim())}/></label>}
        {mode!=='email'&&<><label htmlFor="account-password">{mode==='recover'?'设置新密码':'密码'}<input id="account-password" name="password" type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><small>12–128 个字符。密码仅用于登录，不会随学习备份导出。</small></>}
        {(mode==='email'||mode==='register')&&<EmailVerification key={mode} sync={controller.current} purpose={mode==='register'?'register':'login'} ready={state.mailReady} onProof={setProof}/>}
        {(error||state.error&&state.available!==false)&&<p className="account-error" role="alert">{error||state.error}</p>}
        <button className="button primary" type="submit" disabled={state.authBusy||state.available===false||state.status==='checking'}>{state.authBusy?<><LoaderCircle size={16} className="spin"/>正在处理…</>:mode==='email'?'验证码登录':mode==='login'?'登录并同步':mode==='register'?'创建账号':'重设密码并登录'}</button>
      </form></>}
      {user&&!!user.email&&!state.authRequired&&<div className="account-actions"><button className="button" disabled={state.authBusy||state.status==='syncing'||state.status==='conflict'} onClick={()=>void controller.current?.refresh()}>立即同步</button><button className="text-button" disabled={state.authBusy} onClick={()=>void controller.current?.logout().catch(()=>{})}>退出登录</button></div>}
      {user&&state.authRequired&&<button className="text-button" disabled={state.authBusy} onClick={()=>void controller.current?.logout().catch(()=>{})}>退出此账号，使用本机阅读</button>}
      {!showForm&&!binding&&state.error&&state.status!=='conflict'&&<p className="account-error" role="alert">{state.error}</p>}
      {state.status==='conflict'&&<div className="account-conflict" role="alert"><h3>有 {state.conflicts.length} 处内容需要你决定</h3><p>{state.error}其他不冲突的修改会自动合并。</p><div className="account-actions"><button className="button" onClick={()=>download('readspace-sync-conflict.json',controller.current?.conflictBackup()||'{}')}>下载两份记录备份</button><button className="button" onClick={()=>controller.current?.resolve('local')}>冲突处保留本机</button><button className="button" onClick={()=>controller.current?.resolve('cloud')}>冲突处保留云端</button></div></div>}
      {state.migrationPending&&<div className="account-migration"><h3>发现这台设备原来的阅读记录</h3><p>是否把旧的本机记录合并到当前账号？相同记录有不同内容时保留账号版本；原本机记录仍保留。</p><div className="account-actions"><button className="button" onClick={()=>controller.current?.importGuest()}>合并本机旧记录</button><button className="text-button" onClick={()=>controller.current?.dismissMigration()}>暂不合并</button></div></div>}
      <p className="account-footnote">联网时自动同步，页面停留期间每 30 秒检查更新。离线修改先保存在此设备，恢复联网后继续同步；看到“已同步”后，其他设备才能读取。仍建议定期导出备份。</p>
      {state.storageError&&<p className="account-error" role="alert">本机缓存写入失败，请保持页面打开，联网同步或立即导出备份。</p>}
    </div>
  </section>;
}
