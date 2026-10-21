import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { FEED_SOURCES } from "../lib/article-feeds.ts";
import { isDiscoveryResponse } from "../lib/discovery-types.ts";
const origin=process.env.QA_URL||"http://127.0.0.1:5173";
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:"zh-CN",reducedMotion:"reduce"});
 const p=await context.newPage();p.on("pageerror",e=>errors.push(e.message));
 const response=await p.request.get(origin+"/api/discover?v=2",{timeout:20000});assert.equal(response.status(),200);const server=await response.json();assert.equal(isDiscoveryResponse(server),true);
 // Workerd local egress does not use Windows' system proxy. Use the independently
 // fetched official feeds to verify every publisher in the browser as well.
 const live=JSON.parse(await readFile("outputs/qa/live-sources.json","utf8"));assert.equal(isDiscoveryResponse(live),true);
 for(const source of FEED_SOURCES.slice(3)){assert.ok(live.articles.some(a=>a.source===source.name),source.name);}
 console.log(`PASS endpoint reports ${server.status}; verified official feeds contain ${live.articles.length} articles including all four new publishers`);
 let partial=false;
 await p.route("**/api/discover*",r=>r.fulfill({json:partial?{...live,status:"partial",articles:live.articles.filter(a=>a.source!=="Breaking News English"),sources:live.sources.map(s=>s.name==="Breaking News English"?{...s,status:"error",count:0}:s)}:live}));
 await p.goto(origin+"/#library",{waitUntil:"networkidle"});await p.waitForFunction(count=>document.querySelectorAll(".quiet-article-row").length>=count,live.articles.length);
 assert.match(await p.locator(".feed-status summary").textContent(),new RegExp(`/ ${FEED_SOURCES.length} 已连接`));
 await p.locator(".library-feed>summary").click();await p.locator(".quiet-filters>summary").click();await p.getByLabel("文章来源",{exact:false}).selectOption("Breaking News English");
 const expected=live.articles.filter(a=>a.source==="Breaking News English");assert.equal(await p.locator(".quiet-article-row").count(),expected.length);assert.ok((await p.locator(".article-row-meta>span:first-child").allTextContents()).every(s=>s==="Breaking News English"));
 await p.getByLabel("难度",{exact:false}).selectOption("2");assert.equal(await p.locator(".quiet-article-row").count(),expected.length);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const first=expected[0];await p.getByRole("button",{name:`收藏 ${first.title}`,exact:true}).click();const before=await p.evaluate(()=>JSON.parse(localStorage.getItem("readspace.study.v1")));
 partial=true;await p.getByRole("button",{name:"立即刷新",exact:true}).click();await p.getByText("部分来源暂不可用，保留上次文章",{exact:true}).waitFor();assert.equal(await p.locator(".quiet-article-row").count(),expected.length);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem("readspace.study.v1"))),before);
 assert.match(await p.locator(".feed-status summary").textContent(),new RegExp(`${FEED_SOURCES.length-1} / ${FEED_SOURCES.length}`));
 console.log("PASS publisher and level filters combine; unavailable publishers keep cached articles and saved learning data");
 await mkdir("outputs/qa",{recursive:true});for(const width of [390,320,1440]){await p.setViewportSize({width,height:width===1440?1000:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:`outputs/qa/expanded-sources-${width}.png`});}
 console.log("PASS expanded source filters fit mobile and desktop without horizontal overflow");
 await p.getByRole("button",{name:"重置筛选",exact:true}).click();await p.getByLabel("文章来源",{exact:false}).selectOption("Smithsonian Magazine · History");assert.equal(await p.locator(".quiet-article-row").count(),live.articles.filter(a=>a.source==="Smithsonian Magazine · History").length);
 await p.getByRole("button",{name:"重置筛选",exact:true}).click();await p.getByLabel("文章来源",{exact:false}).selectOption("The Guardian · Education");const guardian=live.articles.find(a=>a.source==="The Guardian · Education");await p.getByRole("button",{name:guardian.title,exact:true}).click();await p.getByRole("button",{name:"粘贴正文精读",exact:true}).click();assert.equal(await p.getByLabel("文章标题",{exact:false}).inputValue(),guardian.title);assert.ok(await p.getByRole("dialog").locator("input").evaluateAll((inputs,url)=>inputs.some(i=>i.value===url),guardian.sourceUrl));await p.getByRole("button",{name:"关闭",exact:true}).click();
 await p.reload({waitUntil:"networkidle"});assert.ok((await p.evaluate(()=>JSON.parse(localStorage.getItem("readspace.study.v1")))).saved.includes(first.id));
 console.log("PASS new sources keep their original link and import title; bookmarks survive reload");
 assert.deepEqual(errors,[]);await context.close();console.log("All expanded-source checks passed; no browser exceptions.");
}finally{await browser.close();}
