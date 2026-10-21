import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const origin=process.env.QA_URL||"http://127.0.0.1:5173";
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true});
const now=Date.parse("2026-10-19T08:00:00Z");
const article=(id,title,date)=>({id,title,date,subtitle:"BBC News · Education",source:"BBC News · Education",sourceUrl:`https://www.bbc.com/news/articles/${id}`,topic:"校园与成长",level:3,kind:"external",image:"/images/study.jpg",paragraphs:[],description:"来自官方订阅的英文文章。"});
const old=article("old","Campus learning habits","2026-10-18T08:00:00.000Z"),latest=article("new","A new science discovery","2026-10-19T07:00:00.000Z");
const payload=items=>({articles:items,status:"live",checkedAt:new Date(now).toISOString(),sources:[{id:"bbc-education",name:"BBC News · Education",url:"https://feeds.bbci.co.uk/news/education/rss.xml",status:"ok",count:items.length,lastPublishedAt:items[0].date}]});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:"zh-CN"});
 const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
 let calls=0,mode="old",initialCount=0;
 await page.route("**/api/discover*",async route=>{calls++;if(mode==="fail")return route.abort();await route.fulfill({json:payload(mode==="old"?[old]:[latest,old])});});
 await page.clock.install({time:new Date(now)});
 await page.goto(origin+"/#library",{waitUntil:"networkidle"});await page.getByRole("button",{name:"真实来源",exact:true}).click();await page.getByRole("button",{name:"Campus learning habits",exact:true}).waitFor();await page.locator(".library-feed>summary").click();
 initialCount=await page.locator(".quiet-article-row").count();assert.equal(calls,1);assert.match(await page.locator(".quiet-article-row time").textContent(),/2026/);assert.match(await page.getByLabel("搜索文章",{exact:true}).getAttribute("placeholder"),/关键词/);
 console.log("PASS opening Discover automatically requests real articles and displays original publication time");
 mode="new";await page.clock.fastForward(300_100);await page.getByRole("button",{name:"A new science discovery",exact:true}).waitFor();assert.equal(calls,2);assert.match(await page.locator(".feed-status-top").textContent(),/发现 1 篇新文章/);
 console.log("PASS five-minute automatic refresh adds new articles");
 const beforeSearch=calls;await page.getByLabel("搜索文章",{exact:true}).fill("  SCIENCE  ");assert.equal(await page.locator(".quiet-article-row").count(),1);assert.equal(calls,beforeSearch);await page.getByLabel("搜索文章",{exact:true}).fill("");
 console.log("PASS case-insensitive keyword search filters loaded articles without a model or network call");
 await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});document.dispatchEvent(new Event("visibilitychange"));});const beforeHidden=calls;await page.clock.fastForward(300_100);assert.equal(calls,beforeHidden);
 await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});document.dispatchEvent(new Event("visibilitychange"));});await page.waitForFunction(()=>!document.querySelector(".feed-status button")?.disabled);assert.equal(calls,beforeHidden+1);
 console.log("PASS background pages pause requests and returning to the foreground checks again");
 mode="fail";await page.getByRole("button",{name:"立即刷新",exact:true}).click();await page.getByText("连接暂不可用，保留已有文章",{exact:true}).waitFor();assert.equal(await page.locator(".quiet-article-row").count(),initialCount+1);await page.reload({waitUntil:"networkidle"});await page.getByRole("button",{name:"真实来源",exact:true}).click();await page.locator(".library-feed>summary").click();await page.getByText("连接暂不可用，保留已有文章",{exact:true}).waitFor();assert.equal(await page.locator(".quiet-article-row").count(),initialCount+1);
 console.log("PASS network failure preserves the last articles, including after reload");
 mode="new";await page.getByRole("button",{name:"收藏 A new science discovery",exact:true}).click();const study=await page.evaluate(()=>JSON.parse(localStorage.getItem("readspace.study.v1")));assert.ok(study.saved.includes("new"));assert.equal(study.external[0].sourceUrl,latest.sourceUrl);
 await page.getByRole("button",{name:"立即刷新",exact:true}).click();await page.waitForFunction(()=>!document.querySelector(".feed-status button")?.disabled);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem("readspace.study.v1"))),study);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator(".feed-status summary").click();await page.setViewportSize({width:320,height:720});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mkdir("outputs/qa",{recursive:true});await page.screenshot({path:"outputs/qa/live-feed-mobile.png",fullPage:true});
 console.log("PASS refresh preserves saved learning data and the 320px mobile layout fits");
 await page.evaluate(()=>location.hash="read/green-spaces");await page.locator(".reading-body").waitFor();const beforeReader=calls;await page.clock.fastForward(600_100);assert.equal(calls,beforeReader);
 assert.deepEqual(errors,[]);console.log("PASS reader does not poll feeds; no browser exceptions");await context.close();
}finally{await browser.close();}
