import { test } from "node:test";
import assert from "node:assert/strict";
import { FEED_SOURCES, parseFeed, collectFeeds } from "../lib/article-feeds.ts";
import { isDiscoveryResponse } from "../lib/discovery-types.ts";
import {curated} from "../lib/articles.ts";
import {articleImportPolicy} from "../lib/article-import-policy.mjs";

const now=Date.parse("2026-10-19T08:00:00Z");
const item=(title,url,date="Mon, 19 Oct 2026 01:57:02 GMT")=>`<item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>${date}</pubDate></item>`;
const source=FEED_SOURCES[0];
test("China Daily curated articles are valid official links without copied article bodies",()=>{
 const articles=curated.filter(a=>a.source==='China Daily');assert.equal(articles.length,3);assert.equal(new Set(articles.map(a=>a.id)).size,3);
 assert.ok(articles.every(a=>a.paragraphs.length===0&&articleImportPolicy(a.sourceUrl).supported===false));
 assert.equal(isDiscoveryResponse({articles,sources:[],status:'fallback',checkedAt:new Date(now).toISOString()}),true);
 assert.equal(isDiscoveryResponse({articles:[{...articles[0],sourceUrl:'https://www.chinadaily.com.cn.evil.test/a/story'}],sources:[],status:'fallback',checkedAt:new Date(now).toISOString()}),false);
});
const sourceLink=(s,slug="story")=>`https://${s.hosts[0]}${s.id.startsWith("bbc")?"/news/articles/":s.pathPrefixes?.[0]||"/2610/"}${slug}`;
test("RSS retains actual dates, decodes titles, rejects unsafe links and deduplicates tracking URLs",()=>{
 const xml=item("Earlier &amp; &#x41;","https://www.bbc.com/news/articles/old","Fri, 16 Oct 2026 08:00:00 GMT")+item("Newest","https://www.bbc.com/news/articles/new?utm_source=rss")+item("Duplicate","https://www.bbc.com/news/articles/new#share")+item("Unsafe","https://www.bbc.com.evil.test/news/articles/a")+item("Insecure","http://www.bbc.com/news/articles/a")+item("Wrong path","https://www.bbc.com/account");
 const parsed=parseFeed(xml,source,now);assert.equal(parsed.length,2);assert.equal(parsed[0].title,"Newest");assert.equal(parsed[0].sourceUrl,"https://www.bbc.com/news/articles/new");assert.equal(parsed[0].date,"2026-10-19T01:57:02.000Z");assert.equal(parsed[1].title,"Earlier & A");assert.deepEqual(parsed[0].paragraphs,[]);
});
test("Missing and future publication dates are never invented",()=>{
 for(const date of ["not a date","Mon, 19 Oct 2027 01:57:02 GMT"]){assert.equal(parseFeed(item("News","https://www.bbc.com/news/articles/a",date),source,now)[0].date,undefined);}
 assert.throws(()=>parseFeed("x".repeat(2_000_001),source,now));
});
test("One unavailable provider does not discard successful feeds; old providers are identified",async()=>{
 const result=await collectFeeds(async url=>{
  const s=FEED_SOURCES.find(s=>s.url===url);
  if(s.id===source.id)throw new Error("offline");
  return new Response(s.id.startsWith("voa")?item("Old",sourceLink(s),"Mon, 17 Mar 2025 22:05:00 GMT"):item("Current",sourceLink(s)));
 },now);
 assert.equal(result.status,"partial");assert.equal(result.articles.length,FEED_SOURCES.length-1);assert.equal(result.articles[0].title,"Current");assert.equal(result.sources.find(s=>s.id==="voa-science").stale,true);assert.equal(result.sources[0].status,"error");assert.equal(isDiscoveryResponse(result),true);
});
test("All-source failure is explicit and successful feeds deduplicate across collections",async()=>{
 const failed=await collectFeeds(async()=>new Response("unavailable",{status:503}),now);assert.equal(failed.status,"fallback");assert.deepEqual(failed.articles,[]);assert.equal(failed.sources.length,FEED_SOURCES.length);
 const good=await collectFeeds(async url=>new Response(item("Title",sourceLink(FEED_SOURCES.find(s=>s.url===url)))),now);assert.equal(good.status,"live");assert.equal(good.articles.length,FEED_SOURCES.length-1);assert.equal(isDiscoveryResponse(good),true);assert.equal(isDiscoveryResponse({...good,articles:[{...good.articles[0],sourceUrl:"javascript:alert(1)"}]}),false);
});
test("New publishers have stable IDs, reject other hosts and omit sponsored paths",()=>{
 for(const s of FEED_SOURCES.slice(3)){
  const link=sourceLink(s);const a=parseFeed(item("Title",link+"?utm_medium=rss")+item("Wrong host",link.replace(s.hosts[0],s.hosts[0]+".evil.test")),s,now);
  assert.equal(a.length,1);assert.equal(a[0].id,parseFeed(item("Title",link),s,now)[0].id);assert.equal(isDiscoveryResponse({articles:a,sources:[],status:"live",checkedAt:new Date(now).toISOString()}),true);
 }
 const smith=FEED_SOURCES.find(s=>s.id==="smithsonian-history");assert.equal(parseFeed(item("Ad","https://www.smithsonianmag.com/sponsored/story/"),smith,now).length,0);
 const guardian=FEED_SOURCES.find(s=>s.id==="guardian-education");assert.notEqual(parseFeed(item("Old","https://www.theguardian.com/education/2025/oct/19/schools"),guardian,now)[0].id,parseFeed(item("New","https://www.theguardian.com/education/2026/oct/19/schools"),guardian,now)[0].id);
});
test("Expanded feeds remain within cache capacity and retain legacy bookmark IDs",async()=>{
 const all=await collectFeeds(async url=>{const s=FEED_SOURCES.find(s=>s.url===url);return new Response(Array.from({length:20},(_,i)=>item(`Article ${i}`,sourceLink(s,`article-${i}`))).join(""));},now);
 assert.equal(all.status,"live");assert.ok(all.articles.length+3<=100);assert.equal(isDiscoveryResponse(all),true);assert.equal(new Set(all.articles.map(a=>a.id)).size,all.articles.length);
 assert.equal(parseFeed(item("VOA","https://learningenglish.voanews.com/a/story/1.html"),FEED_SOURCES.find(s=>s.id==="voa-science"),now)[0].id,"voa-1.html");
});
