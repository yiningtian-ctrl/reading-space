"use client";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import {BookOpen,Home,Library,NotebookPen,RefreshCw,UserRound,Plus,Check,X,LoaderCircle,Cloud} from "lucide-react";
import {articles,curated} from "@/lib/articles";
import {useStudyAccount} from "@/hooks/use-study-account";
import MobileApp,{MobilePlatform} from "./mobile-app";
import AccountPanel,{syncLabels} from "./account-panel";
import type {Article,StudyData} from "@/lib/reading";
import {normalizeArticleUrl} from "@/lib/article-import-policy.mjs";
import {useDiscoveryFeed} from "@/hooks/use-discovery-feed";
import Reader from "./reader";
import ImportDialog from "./import-dialog";
import {Empty} from "./reading-ui";
import {HomePage,LibraryPage,ProfilePage} from "./study-pages";
import Notebook from "./study-notebook";
import StudyReview from "./study-review";

type View="home"|"library"|"vocabulary"|"review"|"profile"|"reader";
const nav=[{id:"home",zh:"首页",en:"Home",icon:Home},{id:"library",zh:"图书馆",en:"Library",icon:Library},{id:"vocabulary",zh:"词句本",en:"Notebook",icon:NotebookPen},{id:"review",zh:"复习",en:"Review",icon:RefreshCw},{id:"profile",zh:"我的",en:"My space",icon:UserRound}] as const;

export default function ReadSpace(){
  const [view,setView]=useState<View>("home"),[articleId,setArticleId]=useState("green-spaces"),[message,setMessage]=useState(""),[importing,setImporting]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const toast=useCallback((text:string)=>{setMessage(text);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setMessage(""),4000);},[]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  const {data,ready,dataRef,update,state:account,controller}=useStudyAccount(toast);
  const feedInfo=useDiscoveryFeed(ready&&view==="library");
  useEffect(()=>{setImporting(false);setMessage("");},[account.user?.id]);
  useEffect(()=>{const route=()=>{const route=location.hash.replace(/^#\/?/,"");if(route.startsWith("read/")){setView("reader");try{setArticleId(decodeURIComponent(route.slice(5)));}catch{setArticleId("");}}else setView(route==="discover"?"library":nav.some(n=>n.id===route)?route as View:"home");};route();window.addEventListener("hashchange",route);return()=>window.removeEventListener("hashchange",route);},[]);
  const catalog=useMemo(()=>Array.from(new Map([...articles,...curated,...data.external,...feedInfo.articles,...data.imported].map(a=>[a.id,a])).values()),[data.external,data.imported,feedInfo.articles]);
  const selected=catalog.find(a=>a.id===articleId);
  const go=useCallback((target:View)=>{setView(target);setImporting(false);setMessage("");location.hash=target;window.scrollTo({top:0});},[]);
  const open=useCallback((a:Article)=>{if(a.kind==="external")update(d=>({...d,external:[...d.external.filter(x=>x.id!==a.id),a]}));setArticleId(a.id);setView("reader");location.hash=`read/${encodeURIComponent(a.id)}`;window.scrollTo({top:0});},[update]);
  const acceptImported=(incoming:Article)=>{const url=normalizeArticleUrl(incoming.sourceUrl),d=dataRef.current,same=url?d.imported.find(a=>a.paragraphs.length&&normalizeArticleUrl(a.sourceUrl)===url):undefined;
    if(same){setImporting(false);open(same);toast("继续使用已有文章与批注");return;}
    const empty=url?d.imported.find(a=>!a.paragraphs.length&&normalizeArticleUrl(a.sourceUrl)===url):undefined;
    const article=empty?{...incoming,id:empty.id,title:empty.title,topic:empty.topic,level:empty.level}:incoming;
    update(d=>{const linked=url?d.external.filter(a=>normalizeArticleUrl(a.sourceUrl)===url).map(a=>a.id):[];return{...d,imported:[article,...d.imported.filter(a=>a.id!==article.id)],saved:Array.from(new Set([...d.saved.filter(id=>!linked.includes(id)),article.id]))};});setImporting(false);open(article);toast(article.paragraphs.length?"正文已导入":"链接已加入书架");
  };
  const toggleSave=(a:Article)=>{const saved=dataRef.current.saved.includes(a.id);update(d=>({...d,saved:saved?d.saved.filter(id=>id!==a.id):[a.id,...d.saved],external:a.kind==="external"?[...d.external.filter(x=>x.id!==a.id),a]:d.external}));toast(saved?"已移出书架":"已加入书架");};
  const recent=Object.entries(data.records).sort((a,b)=>b[1].lastReadAt.localeCompare(a[1].lastReadAt)).map(([id,record])=>({article:catalog.find(a=>a.id===id),record})).find(x=>x.article&&!x.record.completedAt);
  return <div className={`app-shell quiet-app ${view==="reader"?"is-reading":""}`}>
    <MobilePlatform/>
    <header className="quiet-topbar"><a className="quiet-brand" href="#home" aria-label="ReadSpace 首页"><BookOpen size={22} strokeWidth={1.6}/><span>ReadSpace<span>.</span></span></a><span className="quiet-caption">给阅读，留一点空间。</span><button className="account-shortcut" onClick={()=>go("profile")} aria-label={"账号与云端同步："+syncLabels[account.status]}><Cloud size={16}/><span>{syncLabels[account.status]}</span></button>{(view==="library"||view==="reader")&&<button className="button import-button" aria-label="导入文章" onClick={()=>setImporting(true)}><Plus size={18}/><span>导入文章</span></button>}</header>
    <main key={account.user?.id||"guest"} className={view==="reader"?"reader-main":"quiet-content"}>
      {account.user&&(account.authRequired||!account.user.email||account.status==='checking')?(view==='profile'?<div className="profile-page"><header className="quiet-page-title"><h1>我的</h1><span>My space</span></header><AccountPanel state={account} controller={controller}/></div>:<Empty title={account.status==='checking'?'正在检查登录':!account.user.email?'请先绑定邮箱':'请重新登录'} text="本机缓存仍保留，登录后继续阅读与同步。" action="前往账号" onAction={()=>go('profile')}/>):<>
      {view==="home"&&<HomePage recent={recent?.article?{article:recent.article,record:recent.record}:undefined} onOpen={open} onLibrary={()=>go("library")}/>}
      {view==="library"&&<LibraryPage data={data} catalog={catalog} feedInfo={feedInfo} onOpen={open} onSave={toggleSave} onImport={()=>setImporting(true)}/>}
      {view==="vocabulary"&&<Notebook data={data} catalog={catalog} update={update} toast={toast} onOpen={open} onLibrary={()=>go("library")}/>}
      {view==="review"&&<StudyReview data={data} update={update} onNotebook={()=>go("vocabulary")} onLibrary={()=>go("library")}/>}
      {view==="profile"&&<ProfilePage data={data} update={update} toast={toast} account={<><AccountPanel state={account} controller={controller}/><MobileApp/></>}/>}
      {view==="reader"&&(ready&&selected?<Reader key={selected.id} article={selected} data={data} update={update} toast={toast} onBack={()=>go("library")} onSave={()=>toggleSave(selected)} onImport={()=>setImporting(true)} onImported={acceptImported} onReview={()=>go("review")}/>:ready?<Empty title="没有找到这篇文章" text="可在‘我的’恢复之前的阅读备份。" action="前往图书馆" onAction={()=>go("library")}/>:<div className="loading-state"><LoaderCircle className="spin"/>正在打开文章…</div>)}
      </>}
    </main>
    {view!=="reader"&&<nav className="quiet-dock" aria-label="主导航">{nav.map(({id,zh,en,icon:Icon})=><button key={id} onClick={()=>go(id)} className={view===id?"active":""} aria-current={view===id?"page":undefined}><Icon size={23} strokeWidth={view===id?1.9:1.5}/><span>{zh}</span><small>{en}</small></button>)}</nav>}
    {message&&<div className="toast" role="status"><Check size={17}/>{message}<button aria-label="关闭提示" onClick={()=>setMessage("")}><X size={14}/></button></div>}
    {importing&&<ImportDialog initialArticle={view==="reader"?selected:undefined} imported={data.imported} onClose={()=>setImporting(false)} onImport={acceptImported}/>}
  </div>;
}
