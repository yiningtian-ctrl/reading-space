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
// Bounded, per-isolate throttling supplements the provider quota. No text is
// retained in this map; it is not a durable global billing/rate-limit system.
const limits=new Map<string,{count:number;until:number}>();let active=0;
async function boundedBody(request:Request){
 const reader=request.body?.getReader();if(!reader)return '';
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>25000){await reader.cancel();throw new TranslationError('本次内容过长，请分段翻译。',413,'too-long');}chunks.push(next.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function handleTranslation(request:Request,fetcher:typeof fetch=fetch):Promise<Response>{
 const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(request.method!=='POST')return reply({error:'请使用 POST 请求。'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'请从 ReadSpace 页面发起翻译。'},403);
 if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return reply({error:'请提交 JSON 格式的英文内容。'},415);
 if(Number(request.headers.get('Content-Length')||0)>25000)return reply({error:'本次内容过长，请分段翻译。'},413);
 let text:string;
 try{const data=JSON.parse(await boundedBody(request));if(typeof data?.text!=='string')throw Error();text=data.text.trim();}catch(error){if(error instanceof TranslationError)return reply({error:error.message},error.status);return reply({error:'请输入要翻译的英文。'},400);}
 if(!text||encoder.encode(text).length>4000||/\r?\n\s*\r?\n/.test(text))return reply({error:'请提交一个段落或句子，每次不超过 4000 字节。'},400);
 const now=Date.now();for(const [key,value]of limits)if(value.until<=now)limits.delete(key);
 const key=request.headers.get('CF-Connecting-IP')||'local';const limit=limits.get(key)||{count:0,until:now+600000};
 if(limit.count>=60||active>=4)return reply({error:'翻译请求较多，请稍后重试。',code:'busy'},429);
 if(!limits.has(key)&&limits.size>=1000)return reply({error:'翻译服务繁忙，请稍后重试。'},503);
 limit.count++;limits.set(key,limit);active++;
 try{return reply(await translateParagraph(text,fetcher,request.signal));}
 catch(error){if(request.signal.aborted)return reply({error:'翻译已取消。',code:'cancelled'},499);const e=error instanceof TranslationError?error:new TranslationError('翻译暂时无法完成，请稍后重试。');return reply({error:e.message,code:e.code},e.status);}
 finally{active--;}
}
