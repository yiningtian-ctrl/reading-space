"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, Check, Clock3, Compass, Info, Search, SlidersHorizontal, X } from "lucide-react";
import { articles } from "@/lib/articles";
import { readMinutes, wordCount } from "@/lib/reading";
import type { Article, StudyData } from "@/lib/reading";
import type { useDiscoveryFeed } from "@/hooks/use-discovery-feed";
import ArticleCard from "./article-card";
import FeedStatus from "./feed-status";

type Props = {
  data: StudyData; query: string; setQuery: (v: string) => void; source: string; setSource: (s: string) => void;
  feedInfo: ReturnType<typeof useDiscoveryFeed>; resume?: { article: Article; progress: number };
  onOpen: (a: Article) => void; onSave: (a: Article) => void; onReview: () => void; onSettings: () => void;
};
const topics = ["全部文章", "校园与成长", "科技与学习", "社会与文化", "环境与生活"];

export default function Discover({ data, query, setQuery, source, setSource, feedInfo, resume, onOpen, onSave, onReview, onSettings }: Props) {
  const [topic, setTopic] = useState("全部文章"), [level, setLevel] = useState("all"), [length, setLength] = useState("all"), [filters, setFilters] = useState(false);
  const [publisher, setPublisher] = useState("all");
  const publishers = useMemo(() => Array.from(new Set(feedInfo.articles.map(a => a.source))).sort((a, b) => a.localeCompare(b)), [feedInfo.articles]);
  const listed = useMemo(() => [...(source === "real" ? feedInfo.articles : source === "mine" ? data.imported : articles)].filter(a => {
    const text = [a.title, a.subtitle, a.description, a.topic, a.kind === "original" ? "四级 CET-4" : "", a.source].join(" ").toLowerCase(), m = readMinutes(a);
    return (source !== "real" || publisher === "all" || a.source === publisher) && (topic === "全部文章" || a.topic === topic) && (!query.trim() || text.includes(query.trim().toLowerCase())) && (level === "all" || a.level === Number(level)) && (length === "all" || a.paragraphs.length > 0 && (length === "short" ? m <= 5 : length === "medium" ? m > 5 && m < 15 : m >= 15));
  }).sort((a, b) => source === "training" ? wordCount(b) - wordCount(a) : 0), [source, feedInfo.articles, data.imported, topic, query, level, length, publisher]);
  const totalMins = Math.floor(Object.values(data.records).reduce((n, r) => n + r.seconds, 0) / 60);
  const done = Object.values(data.records).filter(r => r.completedAt).length;
  const reset = () => { setQuery(""); setTopic("全部文章"); setLevel("all"); setLength("all"); setPublisher("all"); };
  const changeSource = (next: string) => { setSource(next); setTopic("全部文章"); setPublisher("all"); };
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Shanghai" }).toUpperCase();

  return <div className="discover-page">
    <header className="page-intro editorial-intro"><div><div className="eyebrow intro-eyebrow"><span />THE READING EDIT / 你的阅读日常</div><h1><span className="intro-prefix">A little reading. </span><em>A wider world.</em></h1><p>为四级备考，也为看见更广阔的世界。</p></div><span className="editorial-date">{date}<small>STAY CURIOUS.</small></span></header>
    {resume && <button className="continue-reading" onClick={() => onOpen(resume.article)}><span className="continue-label">CONTINUE / 继续阅读</span><strong>{resume.article.title}</strong><span className="continue-progress">{Math.round(resume.progress)}% <ArrowRight size={18} /></span></button>}
    <div className="reading-strip" aria-label="我的阅读积累"><div><span><b>{done}</b> 篇读完</span><span><b>{data.words.length}</b> 个生词</span><span><b>{totalMins}</b> 分钟</span></div><button onClick={data.words.length ? onReview : onSettings}>{data.words.length ? "复习收获" : "阅读目标"}<ArrowUpRight size={15} /></button></div>

    <section className="article-section" aria-label="文章发现">
      <div className="section-heading"><div><span className="eyebrow">THE READING DESK</span><h2><span className="section-name-desktop">{source === "real" ? "Fresh perspectives" : source === "training" ? "Practice with purpose" : "Your own discoveries"}</span><span className="section-name-mobile">{source === "real" ? "Latest reads" : source === "training" ? "CET-4 reads" : "Your reads"}</span><span>.</span><small>{source === "real" ? "最新文章" : source === "training" ? "四级阅读训练" : "我的导入文章"}</small></h2></div><span className="article-count">{String(listed.length).padStart(2, "0")} READS</span></div>
      <div className="discovery-controls">
        <div className="source-switch" aria-label="内容来源"><button className={source === "real" ? "active" : ""} onClick={() => changeSource("real")}>真实来源<ArrowUpRight size={13} /></button><button className={source === "training" ? "active" : ""} onClick={() => changeSource("training")}>四级训练</button><button className={source === "mine" ? "active" : ""} onClick={() => changeSource("mine")}>我的导入</button></div>
        <label className="mobile-search"><Search size={18} /><input aria-label="手机搜索文章" placeholder="搜索文章、主题或关键词" value={query} onChange={e => setQuery(e.target.value)} />{query && <button onClick={() => setQuery("")} aria-label="清除搜索"><X size={18} /></button>}</label>
      </div>
      <div className="filter-bar"><div className="topic-tabs">{topics.map(t => <button key={t} className={topic === t ? "active" : ""} onClick={() => setTopic(t)}>{t === "全部文章" && <Compass size={15} />}{t}</button>)}</div><button className={`filter-toggle ${filters || level !== "all" || length !== "all" || publisher !== "all" ? "selected" : ""}`} aria-label="筛选" onClick={() => setFilters(!filters)} aria-expanded={filters}><SlidersHorizontal size={17} /><span>筛选</span>{(level !== "all" || length !== "all" || publisher !== "all") && <span className="filter-dot" />}</button></div>
      {filters && <div className="expanded-filters">{source === "real" && <label className="publisher-filter">文章来源 <select value={publisher} onChange={e => setPublisher(e.target.value)}><option value="all">全部来源</option>{publishers.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}<label>难度 <select value={level} onChange={e => setLevel(e.target.value)}><option value="all">全部难度</option><option value="1">Level 1 · 四级入门</option><option value="2">Level 2 · 四级进阶</option><option value="3">Level 3 · 六级拓展</option></select></label><label>预计阅读 <select value={length} onChange={e => setLength(e.target.value)}><option value="all">全部时长</option><option value="short">短篇 · 5 分钟以内</option><option value="medium">中篇 · 6–14 分钟</option><option value="long">长篇 · 15 分钟以上</option></select></label><button className="text-button" onClick={reset}>重置筛选</button></div>}
      <p className="keyword-hint">关键词搜索 · 当前分类的标题、主题与简介</p>
      {source === "real" && <FeedStatus {...feedInfo} />}
      {query && <div className="search-results">“{query}” 的搜索结果 · {listed.length} 篇<button onClick={() => setQuery("")}>清除 <X size={14} /></button></div>}
      {listed.length ? <div className="article-grid editorial-grid">{listed.map((a, i) => <ArticleCard key={a.id} index={i + 1} article={a} data={data} onOpen={onOpen} onSave={onSave} />)}</div> : <div className="empty"><Search size={28} /><h3>{source === "mine" && !data.imported.length ? "留一个位置，给你发现的好文章" : "暂时没有匹配的文章"}</h3><p>{source === "mine" ? "点击右上角「导入文章」，粘贴正文或收藏链接。" : "换个关键词，或试试其他主题和时长。"}</p><button className="button primary" onClick={reset}>重置筛选<ArrowRight size={16} /></button></div>}
      <p className="content-disclosure"><Info size={14} />{source === "training" ? "训练文章为 AI 辅助原创，非考试真题；难度标签仅供参考。词汇、解析与译文为预编写辅助。" : source === "real" ? "保留官方来源与原文链接；正文请前往原站阅读，或自行粘贴导入精读。" : "导入内容仅保存在当前浏览器。清除浏览器数据前，请导出备份。"}</p>
    </section>

    <section className="guided-pick" aria-label="精选精读">
      <article className="hero-card"><img className="hero-image" src="/images/forest.jpg" alt="阳光穿过安静的森林" /><div className="hero-shade" /><div className="hero-top"><span>01 / THE GUIDED READ · 精选精读</span><button className={`hero-save ${data.saved.includes(articles[0].id) ? "saved" : ""}`} onClick={() => onSave(articles[0])} aria-label="收藏今日精选" aria-pressed={data.saved.includes(articles[0].id)}><Bookmark size={20} fill={data.saved.includes(articles[0].id) ? "currentColor" : "none"} /></button></div><div className="hero-content"><span className="hero-topic">NATURE & EVERYDAY LIFE</span><h2>The quiet power<br />of green spaces.</h2><p>一片绿意，如何改变我们的生活？</p><div className="hero-bottom"><button className="button light" onClick={() => onOpen(articles[0])}>开始阅读<ArrowUpRight size={18} /></button><span><Clock3 size={15} />{readMinutes(articles[0])} min<span>·</span>CET-4 进阶</span></div></div></article>
      <aside className="guided-note"><span className="eyebrow">A LITTLE HELP, WHEN YOU NEED IT.</span><h3>Find your rhythm.<br /><em>Read a little deeper.</em></h3><p>从一篇 400 词的文章开始。<br />遇到困难时，再展开一点帮助。</p><ol><li><Check size={16} />点击生词，连同原句收藏</li><li><Check size={16} />逐步展开词汇、结构与译文</li><li><Check size={16} />划出好句，留下自己的理解</li></ol><span className="guided-foot">READSPACE ORIGINAL / 原创训练 · 非真题</span></aside>
    </section>
    <footer className="editorial-manifesto"><span>READ. THINK. KEEP.</span><p>Read for the exam.<br /><em>Stay for the world.</em></p><small>从读懂一篇文章，到拥有自己的观点。</small></footer>
  </div>;
}
