"use client";
import {useEffect,useState} from 'react';
import type {StudySync} from '@/lib/study-sync-client';
export default function EmailVerification({sync,purpose,ready,onProof}:{sync:StudySync|null;purpose:'login'|'register'|'bind';ready?:boolean;onProof:(proof:{email:string;code:string;challengeId:string})=>void}){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[id,setId]=useState(''),[remaining,setRemaining]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{onProof({email,code,challengeId:id});},[email,code,id,onProof]);
 useEffect(()=>{if(!remaining)return;const timer=setTimeout(()=>setRemaining(remaining-1),1000);return()=>clearTimeout(timer);},[remaining]);
 const send=async()=>{setBusy(true);setError('');try{const result=await sync?.sendEmailCode(email,purpose);if(result){setId(result.challengeId);setRemaining(result.retryAfter);setMessage('验证码已提交发送，请检查收件箱和垃圾邮件，10 分钟内有效。');}}catch(e){setError(e instanceof Error?e.message:'发送失败，请重试。');}finally{setBusy(false);}};
 return <div className="email-fields account-form"><label>邮箱<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setId('');setCode('');setMessage('');}}/></label><button type="button" className="button" disabled={busy||remaining>0||ready===false} onClick={()=>void send()}>{busy?'正在发送…':remaining?remaining+' 秒后重发':'发送验证码'}</button><label>邮箱验证码<input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value)}/></label>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="account-error">{error}</p>}</div>;
}
