import {translateParagraph} from './translation-core';
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
  const direct:typeof fetch=(input,init)=>fetch(input,{...init,credentials:'omit',referrerPolicy:'no-referrer'});
  const result=await translateParagraph(text,direct,signal);
  if(result.translation.length>80000)throw new Error('译文过长，超过可保存的长度限制；请缩短所选内容后重试。');
  return result.translation;
}
