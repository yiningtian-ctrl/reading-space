import { test } from "node:test";
import assert from "node:assert/strict";
import { articleImportPolicy } from "../lib/article-import-policy.mjs";
import { ArticleImporter } from "../lib/article-import-service.mjs";
import { extractPublicArticle } from "../lib/article-extraction.mjs";
import { defaultData, validateData } from "../lib/reading.ts";
const url="https://learningenglish.voanews.com/a/test-article/1234567.html";
const paragraph=i=>`Paragraph ${i}: Reading an article with attention helps students notice the relationship between an idea and its evidence. A good reader pauses to ask why an author has chosen a particular example. Students can keep useful vocabulary in its original sentence, return to an unfamiliar expression, and explain the argument in their own words. This small practice makes a reading habit more meaningful.`;
const html=`<!doctype html><html><head><title>A public reading article</title></head><body><nav>Navigation not part of the article</nav><article><h1>A public reading article</h1>${[1,2,3,4].map(i=>`<p>${paragraph(i)}</p>`).join("")}<p hidden>Hidden premium paragraph</p><script>unwanted()</script></article></body></html>`;
const source=articleImportPolicy(url).source;
const response=text=>new Response(text,{headers:{"Content-Type":"text/html; charset=utf-8"}});
test("Only approved public article URLs are eligible; BBC and local/internal targets never fetch",async()=>{
 let calls=0;const importer=new ArticleImporter({fetcher:async()=>{calls++;throw new Error("unexpected");}});
 for(const target of ["http://www.sciencenews.org/article/story","https://127.0.0.1/a","https://metadata.google.internal/","https://www.bbc.com/news/articles/cmvgxvkv54w1o","https://breakingnewsenglish.com/2610/261019-food-waste.html","https://learningenglish.voanews.com.evil.test/a/test/123.html","https://user:pass@www.sciencenews.org/article/story","https://www.sciencenews.org:8443/article/story","https://www.theguardian.com/robots.txt"]){await assert.rejects(importer.import(target),e=>e.code==="unsupported");}
 assert.equal(calls,0);assert.equal(articleImportPolicy("https://www.sciencenews.org/article/test").supported,true);
});
test("Extraction yields stable import IDs, visible paragraphs and valid ReadSpace data",async()=>{
 const a=await extractPublicArticle(html,url,source),b=await extractPublicArticle(html,url,source);assert.equal(a.id,b.id);assert.equal(a.paragraphs.length,4);assert.ok(!JSON.stringify(a).includes("Hidden premium"));assert.ok(!JSON.stringify(a).includes("Navigation not"));assert.equal(validateData({...defaultData,imported:[a]}),true);assert.equal(a.sourceUrl,url);
});
test("Paywall metadata, verification pages and teasers do not become imported articles",async()=>{
 await assert.rejects(extractPublicArticle(html.replace("<head>",'<head><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script>'),url,source),e=>e.code==="restricted");
 await assert.rejects(extractPublicArticle("<html><title>Verify you are human</title></html>",url,source),e=>e.code==="challenge");
 await assert.rejects(extractPublicArticle("<html><title>News</title><article><p>A short teaser.</p></article></html>",url,source),e=>["snippet","no_content"].includes(e.code));
});
test("robots prohibition is respected before requesting body; plain robots works with an HTML MIME type",async()=>{
 const calls=[];const blocked=new ArticleImporter({wait:async()=>{},fetcher:async address=>{calls.push(address);return response("User-agent: *\nDisallow: /a/");}});await assert.rejects(blocked.import(url),e=>e.code==="robots");assert.equal(calls.length,1);
 const good=new ArticleImporter({wait:async()=>{},fetcher:async address=>response(address.endsWith("robots.txt")?"User-agent: *\nDisallow:":html)});assert.equal((await good.import(url)).paragraphs.length,4);
});
test("Redirects cannot escape the allowlist or enter paths forbidden by robots",async()=>{
 for(const location of ["https://127.0.0.1/private","https://www.theguardian.com/education/2026/oct/19/test", "https://learningenglish.voanews.com/a/private/9999999.html"]){let calls=0;const importer=new ArticleImporter({wait:async()=>{},fetcher:async address=>{calls++;return address.endsWith("robots.txt")?response("User-agent: *\nDisallow: /a/private/"):new Response(null,{status:302,headers:{location}});}});await assert.rejects(importer.import(url),e=>["redirect","robots"].includes(e.code));assert.equal(calls,2);}
});
test("Concurrency, cached robots and upstream rate limits prevent repeated requests",async()=>{
 let clock=10000,calls=0,release;const gate=new Promise(r=>release=r);
 const importer=new ArticleImporter({clock:()=>clock,wait:async()=>{},fetcher:async address=>{calls++;if(address.endsWith("robots.txt"))return response("User-agent: *\nDisallow:");await gate;return response(html);}});
 const pending=importer.import(url);await assert.rejects(importer.import(url),e=>e.status===429);release();await pending;assert.equal(calls,2);await assert.rejects(importer.import(url),e=>e.status===429);clock+=3100;await importer.import(url);assert.equal(calls,3);
 const limited=new ArticleImporter({clock:()=>clock,wait:async()=>{},fetcher:async address=>address.endsWith("robots.txt")?response("User-agent: *\nDisallow:"):new Response("limited",{status:429,headers:{"Retry-After":"120"}})});await assert.rejects(limited.import(url),e=>e.code==="upstream_restricted"&&e.retryAfter===120);clock+=5000;await assert.rejects(limited.import(url),e=>e.status===429);
});
test("Unsupported content types, oversized pages and invalid robots do not return body text",async()=>{
 for(const mode of ["json","large","invalid-robots"]){const importer=new ArticleImporter({wait:async()=>{},fetcher:async address=>address.endsWith("robots.txt")?response(mode==="invalid-robots"?"<html><title>Checking browser</title></html>":"User-agent: *\nDisallow:"):mode==="json"?new Response("{}",{headers:{"Content-Type":"application/json"}}):new Response("x",{headers:{"Content-Type":"text/html","Content-Length":"2000000"}})});await assert.rejects(importer.import(url),e=>["content_type","too_large","robots"].includes(e.code));}
});
