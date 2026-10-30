import {TranslationError,translateParagraph} from './translation-core.ts';
export {TranslationError,translateParagraph,splitTranslationText} from './translation-core.ts';
const encoder=new TextEncoder();
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
