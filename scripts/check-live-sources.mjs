import assert from "node:assert/strict";
import { collectFeeds, FEED_SOURCES } from "../lib/article-feeds.ts";
import { isDiscoveryResponse } from "../lib/discovery-types.ts";
import { mkdir, writeFile } from "node:fs/promises";
const result=await collectFeeds();
console.log(JSON.stringify({status:result.status,total:result.articles.length,valid:isDiscoveryResponse(result),sources:result.sources.map(s=>({name:s.name,status:s.status,count:s.count,lastPublishedAt:s.lastPublishedAt,stale:s.stale}))},null,2));
assert.equal(isDiscoveryResponse(result),true);
for(const s of FEED_SOURCES.slice(3)){assert.ok(result.articles.some(a=>a.source===s.name),`${s.name} should return real articles`);}
assert.equal(new Set(result.articles.map(a=>a.sourceUrl)).size,result.articles.length);
assert.ok(result.articles.every(a=>a.paragraphs.length===0));
await mkdir("outputs/qa",{recursive:true});
await writeFile("outputs/qa/live-sources.json",JSON.stringify(result));
