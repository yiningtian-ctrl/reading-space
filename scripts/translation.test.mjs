import test from 'node:test';import assert from 'node:assert/strict';
import {splitTranslationText,translateParagraph,handleTranslation} from '../lib/translation-server.ts';
import {defaultData,validateData} from '../lib/reading.ts';import {mergeStudy} from '../lib/study-merge.mjs';
const encode=new TextEncoder();
const request=(text,headers={},extra={})=>new Request('https://readspace.test/api/translate',{method:'POST',headers:{Origin:'https://readspace.test','Content-Type':'application/json',...headers},body:JSON.stringify({text}),...extra});
test('UTF8 chunks preserve words and unicode while remaining within provider byte limit',()=>{
 for(const text of ['A quiet place helps. '.repeat(100),'😀'.repeat(500),'x'.repeat(1200)]){const chunks=splitTranslationText(text);assert.ok(chunks.length>1);assert.ok(chunks.every(c=>encode.encode(c).length<=480));assert.equal(chunks.join('').replaceAll(/\s/g,''),text.replaceAll(/\s/g,''));}
});
test('translation sends only one segment and language pair, preserves order and decodes entities',async()=>{
 let n=0;const result=await translateParagraph('One sentence. '.repeat(90),async(url,options)=>{const u=new URL(url);assert.equal(u.origin,'https://api.mymemory.translated.net');assert.equal(u.pathname,'/get');assert.equal(u.searchParams.get('langpair'),'en|zh-CN');assert.ok(encode.encode(u.searchParams.get('q')).length<=500);assert.deepEqual([...u.searchParams.keys()].sort(),['langpair','mt','q']);assert.equal(options.cache,'no-store');return Response.json({responseStatus:200,responseData:{translatedText:'译文'+(++n)+' &quot;test&quot;'}});});assert.ok(n>1);assert.match(result.translation,/译文1 "test"/);assert.equal(result.provider,'MyMemory');
});
test('quota errors, empty or invalid upstream responses never become saved translations',async()=>{
 await assert.rejects(translateParagraph('test',async(url,options)=>{assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://other.test'}});}),e=>e.status===503);
 for(const body of [{responseStatus:429,responseDetails:'quota'}, {responseStatus:200,quotaFinished:true,responseData:{translatedText:'NO QUOTA'}}])await assert.rejects(translateParagraph('test',async()=>Response.json(body)),e=>e.status===429);
 for(const body of [{responseStatus:500},{responseStatus:200,responseData:{translatedText:''}},{responseStatus:200,responseData:{translatedText:'MYMEMORY WARNING: QUERY LENGTH LIMIT EXCEEDED'}}])await assert.rejects(translateParagraph('test',async()=>Response.json(body)),e=>e.status===503);
 await assert.rejects(translateParagraph('test',async()=>new Response('not json')),e=>e.status===503);
});
test('API validates origin, byte length, paragraph and JSON before external requests; responses are not cached',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({responseStatus:200,responseData:{translatedText:'阅读带来思考。'}});};
 assert.equal((await handleTranslation(request('hello',{Origin:'https://other.test'}),fetcher)).status,403);
 assert.equal((await handleTranslation(request('',{},{}),fetcher)).status,400);
 assert.equal((await handleTranslation(request('x'.repeat(4001)),fetcher)).status,400);
 assert.equal((await handleTranslation(request('First.\n\nSecond.'),fetcher)).status,400);
 assert.equal((await handleTranslation(request('x'.repeat(30000)),fetcher)).status,413);assert.equal(calls,0);
 const r=await handleTranslation(request('Reading brings ideas.'),fetcher);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal((await r.json()).translation,'阅读带来思考。');assert.equal(calls,1);
});
test('abort prevents requests; valid translated imports survive validation and cloud merge',async()=>{
 const abort=new AbortController();abort.abort();let called=false;await assert.rejects(translateParagraph('test',async()=>{called=true;return Response.json({});},abort.signal));assert.equal(called,false);
 const base=structuredClone(defaultData);base.imported=[{id:'import-one',title:'Article',subtitle:'',topic:'Study',level:2,source:'Personal',kind:'imported',image:'/images/study.jpg',description:'test',paragraphs:[{en:'A useful sentence.'}]}];
 const local=structuredClone(base),cloud=structuredClone(base);local.imported[0].paragraphs[0]={en:'A useful sentence.',zh:'一个有用的句子。',translationSource:'MyMemory'};cloud.saved=['import-one'];const merged=mergeStudy(base,local,cloud);assert.equal(validateData(merged.data),true);assert.equal(merged.data.imported[0].paragraphs[0].zh,'一个有用的句子。');assert.deepEqual(merged.data.saved,['import-one']);
 local.imported[0].paragraphs[0].translationSource='unknown';assert.equal(validateData(local),false);
});
