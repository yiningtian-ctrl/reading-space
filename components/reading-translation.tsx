"use client";
import {useEffect,useRef,useState} from 'react';
import type {Article,Paragraph,StudyData} from '@/lib/reading';
import {translateText} from '@/lib/translation-client';
import {Modal} from './reading-ui';

type Update=(fn:(data:StudyData)=>StudyData)=>void;
export function TranslationDisclosure(){return <p className="translation-disclosure">翻译会将英文发送至 MyMemory，服务方会保存提交内容，请勿提交敏感资料。机器译文仅供参考；免费额度有限。<a href="https://mymemory.translated.net/terms-and-conditions" target="_blank" rel="noopener noreferrer">服务条款</a> · <a href="https://mymemory.translated.net/doc/usagelimits.php" target="_blank" rel="noopener noreferrer">额度说明</a></p>;}

export function useArticleTranslation(article:Article,update:Update){
  const [visible,setVisible]=useState(false),[running,setRunning]=useState(false),[errors,setErrors]=useState<Record<number,string>>({}),[message,setMessage]=useState('');
  const current=useRef(article);current.current=article;
  const request=useRef<AbortController|null>(null);
  const textKey=JSON.stringify(article.paragraphs.map(p=>p.en)),previousKey=useRef(textKey);
  const cancel=()=>{request.current?.abort();request.current=null;setRunning(false);setMessage('已取消。已完成的译文仍保留，可继续翻译未完成段落。');};
  useEffect(()=>()=>{request.current?.abort();request.current=null;},[]);
  useEffect(()=>{if(previousKey.current!==textKey){previousKey.current=textKey;request.current?.abort();request.current=null;setRunning(false);setErrors({});setMessage('正文已更新，请重新开始翻译。');}},[textKey]);
  const run=async(only?:number)=>{
    if(request.current||current.current.kind!=='imported')return;
    const controller=new AbortController(),id=current.current.id;request.current=controller;setRunning(true);setMessage('正在翻译…');
    try{
      for(let index=0;index<current.current.paragraphs.length;index++){
        if(controller.signal.aborted||request.current!==controller||current.current.id!==id)return;
        if(only!==undefined&&only!==index)continue;
        const paragraph=current.current.paragraphs[index];if(!paragraph.en.trim()||paragraph.zh?.trim())continue;
        const original=paragraph.en;setMessage(`正在翻译第 ${index+1} 段…`);setErrors(old=>{const next={...old};delete next[index];return next;});
        try{
          const translation=await translateText(original,controller.signal);
          if(controller.signal.aborted||request.current!==controller||current.current.id!==id||current.current.paragraphs[index]?.en!==original)return;
          update(data=>({...data,imported:data.imported.map(item=>item.id===id?{...item,paragraphs:item.paragraphs.map((p,i)=>i===index&&p.en===original&&!p.zh?.trim()?{...p,zh:translation,translationSource:'MyMemory' as const}:p)}:item)}));
        }catch(error){
          if(controller.signal.aborted)return;
          const reason=error instanceof Error?error.message:'翻译暂时失败，请重试。';setErrors(old=>({...old,[index]:reason}));setMessage(`第 ${index+1} 段未完成，已完成译文仍保留。`);return;
        }
      }
      if(!controller.signal.aborted)setMessage('本次翻译已完成。译文已保存在这篇导入文章中。');
    }finally{if(request.current===controller){request.current=null;setRunning(false);}}
  };
  return{visible,setVisible,running,errors,message,run,cancel};
}
type TranslationState=ReturnType<typeof useArticleTranslation>;
export function ArticleTranslationControls({article,state}:{article:Article;state:TranslationState}){
  const done=article.paragraphs.filter(p=>p.zh?.trim()).length,total=article.paragraphs.filter(p=>p.en.trim()).length;
  const pending=article.paragraphs.some(p=>p.en.trim()&&!p.zh?.trim());
  return <section className="article-translation-panel" aria-label="文章翻译"><button className="text-button" aria-expanded={state.visible} onClick={()=>{if(state.visible&&state.running)state.cancel();state.setVisible(!state.visible);}}>中英对照</button>{state.visible&&<div className="translation-controls"><TranslationDisclosure/><p>已备好 {done} / {total} 段译文。逐段翻译，保留英文原文。{article.paragraphs.reduce((n,p)=>n+(p.zh?.trim()?0:p.en.length),0)>5000&&'待译正文较长，免费额度可能使翻译中断；已完成段落会保留。'}</p><div className="inline-actions">{state.running?<button className="button" onClick={state.cancel}>取消文章翻译</button>:pending&&<button className="button" onClick={()=>void state.run()}>开始翻译未完成段落</button>}</div><p className="translation-progress" role="status" aria-live="polite">{state.message}</p></div>}</section>;
}
export function ParagraphTranslation({paragraph,index,state}:{paragraph:Paragraph;index:number;state:TranslationState}){
  if(!state.visible)return null;
  const source=(paragraph as Paragraph&{translationSource?:string}).translationSource;
  return <div className="paragraph-translation" data-paragraph={index}>{paragraph.zh?.trim()?<><span>{source==='MyMemory'?'机器译文 · MyMemory':'已有中文译文'}</span><p lang="zh-CN">{paragraph.zh}</p></>:state.errors[index]?<><p role="alert">{state.errors[index]}</p><button className="text-button" disabled={state.running} onClick={()=>void state.run(index)}>重试第 {index+1} 段翻译</button></>:<span>此段暂未翻译</span>}</div>;
}

export function SentenceTranslation({quote,onClose,onSave}:{quote:string;onClose:()=>void;onSave:(text:string)=>void}){
  const [translation,setTranslation]=useState(''),[running,setRunning]=useState(false),[error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>{request.current?.abort();request.current=null;},[]);
  const cancel=()=>{request.current?.abort();request.current=null;setRunning(false);setError('已取消翻译，原句仍保留。');};
  const run=async()=>{if(request.current)return;const controller=new AbortController();request.current=controller;setRunning(true);setError('');try{const text=await translateText(quote,controller.signal);if(!controller.signal.aborted&&request.current===controller)setTranslation(text);}catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'翻译暂时失败，请重试。');}finally{if(request.current===controller){request.current=null;setRunning(false);}}};
  return <Modal title="选句翻译" onClose={onClose}><blockquote className="preview-quote">{quote}</blockquote><TranslationDisclosure/>{running?<><p role="status">正在翻译选句…</p><button className="button" onClick={cancel}>取消选句翻译</button></>:!translation&&<button className="button" onClick={()=>void run()}>翻译这句话</button>}{error&&<p className="translation-error" role="alert">{error}</p>}{translation&&<div className="sentence-translation-result"><span>机器译文 · MyMemory</span><p lang="zh-CN">{translation}</p><button className="button primary" onClick={()=>onSave(`机器译文（MyMemory）：\n${translation}`)}>保存译文为批注</button><p>仅在点击保存后，译文才会加入你的句子批注。</p></div>}</Modal>;
}
