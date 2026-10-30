// One paragraph per call; no account credential, email or IP query parameter.
// MyMemory's documented GET limit is 500 UTF-8 bytes per segment.
const encoder=new TextEncoder();
export class TranslationError extends Error { status:number;code:string;constructor(message:string,status=503,code='unavailable'){super(message);this.status=status;this.code=code;} }
export function splitTranslationText(text:string,maxBytes=480):string[]{
 const chunks:string[]=[];let current='';
 for(const token of text.match(/\S+\s*|\s+/gu)||[]){
  if(encoder.encode(current+token).length<=maxBytes){current+=token;continue;}
  if(current.trim())chunks.push(current.trim());current='';
  for(const char of token){if(encoder.encode(current+char).length>maxBytes){if(current.trim())chunks.push(current.trim());current='';}current+=char;}
 }
 if(current.trim())chunks.push(current.trim());return chunks;
}
function plain(text:string){return text.replace(/&(?:quot|apos|amp|lt|gt|#39|#x27);/g,entity=>({'&quot;':'"','&apos;':"'",'&amp;':'&','&lt;':'<','&gt;':'>','&#39;':"'",'&#x27;':"'"}[entity]||entity)).trim();}
export async function translateParagraph(text:string,fetcher:typeof fetch=fetch,signal?:AbortSignal){
 const output:string[]=[];
 for(const segment of splitTranslationText(text)){
  signal?.throwIfAborted();
  const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',segment);url.searchParams.set('langpair','en|zh-CN');url.searchParams.set('mt','1');
  let response:Response;
  try{response=await fetcher(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000),headers:{Accept:'application/json'},cache:'no-store',redirect:'manual'});}catch(error){signal?.throwIfAborted();throw new TranslationError('翻译服务暂时无法连接，请稍后重试。');}
  if(response.status===429)throw new TranslationError('翻译服务免费额度或请求频率已达限制，请稍后再试。',429,'quota');
  if(!response.ok)throw new TranslationError('翻译服务暂时不可用，请稍后重试。');
  if(Number(response.headers.get('Content-Length')||0)>150000)throw new TranslationError('翻译服务返回了异常内容。');
  const raw=await response.text();if(raw.length>150000)throw new TranslationError('翻译服务返回了异常内容。');
  let data:any;try{data=JSON.parse(raw);}catch{throw new TranslationError('翻译服务返回格式异常，请稍后重试。');}
  const details=String(data.responseDetails||'');
  if(data.quotaFinished||Number(data.responseStatus)===429||/used all available|quota|limit exceeded/i.test(details))throw new TranslationError('翻译服务免费额度已用尽。已完成的译文仍保留，请之后再试。',429,'quota');
  if(Number(data.responseStatus)!==200||typeof data.responseData?.translatedText!=='string')throw new TranslationError('翻译服务未能完成这段内容，请稍后重试。');
  const result=plain(data.responseData.translatedText);
  if(!result||result.length>12000||/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR|YOU USED ALL AVAILABLE/i.test(result))throw new TranslationError('翻译服务未能完成这段内容，请稍后重试。');
  output.push(result);
 }
 return{translation:output.join(' '),provider:'MyMemory' as const};
}
