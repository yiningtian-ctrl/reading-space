export function splitTranslationText(text:string,maxBytes=3500):string[]{
  const chunks:string[]=[];const blocks=text.split(/\n\s*\n/);const encoder=new TextEncoder();
  for(const block of blocks){let remaining=block.trim();
  while(remaining){
    let end=0,bytes=0,boundary=0;
    for(const char of remaining){const size=encoder.encode(char).length;if(bytes+size>maxBytes)break;bytes+=size;end+=char.length;if(/[\s.!?;。！？；]/u.test(char))boundary=end;}
    if(!end)throw new Error('翻译片段无法拆分');
    if(end<remaining.length&&boundary>end/2)end=boundary;
    const chunk=remaining.slice(0,end).trim();if(chunk)chunks.push(chunk);remaining=remaining.slice(end).trimStart();
  }
  }return chunks;
}

export async function translateText(text:string,signal:AbortSignal):Promise<string>{
  const results:string[]=[];
  for(const chunk of splitTranslationText(text,1200)){
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    const controller=new AbortController();let timedOut=false;
    const cancel=()=>controller.abort();signal.addEventListener('abort',cancel,{once:true});
    const timeout=setTimeout(()=>{timedOut=true;controller.abort();},40000);
    try{
      const response=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:chunk}),signal:controller.signal});
      const payload:unknown=await response.json().catch(()=>({}));
      const result=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};
      if(signal.aborted)throw new DOMException('Aborted','AbortError');
      if(!response.ok)throw new Error(typeof result.error==='string'?result.error:response.status===429?'免费翻译额度暂时不足，请稍后重试。':'翻译服务暂时不可用，请稍后重试。');
      if(typeof result.translation!=='string'||!result.translation.trim()||result.provider!=='MyMemory')throw new Error('未收到有效译文，请重试。');
      const translated=result.translation.trim();
      if(results.reduce((n,item)=>n+item.length,0)+translated.length+results.length>80000)throw new Error('译文过长，超过可保存的长度限制；请缩短所选内容后重试。');
      results.push(translated);
    }catch(error){
      if(signal.aborted)throw new DOMException('Aborted','AbortError');
      if(timedOut)throw new Error('翻译请求超时，请稍后重试。');
      throw error instanceof TypeError?new Error('网络暂时不可用，原文和已完成译文仍保留。'):error;
    }finally{clearTimeout(timeout);signal.removeEventListener('abort',cancel);}
  }
  return results.join('\n');
}
