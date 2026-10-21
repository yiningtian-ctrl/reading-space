import { ArrowUpRight, BookOpen, Bookmark, Check, Clock3 } from "lucide-react";
import { readMinutes, wordCount } from "@/lib/reading";
import type { Article, StudyData } from "@/lib/reading";
import { publicationDate } from "./feed-status";

type Props = { article: Article; data: StudyData; onOpen: (a: Article) => void; onSave: (a: Article) => void; index?: number };
const coverTitles: Record<string, string> = { "校园与成长": "LIFE & LEARNING", "科技与学习": "IDEAS & INNOVATION", "社会与文化": "PEOPLE & SOCIETY", "环境与生活": "OUR CHANGING WORLD" };

export default function ArticleCard({ article: a, data, onOpen, onSave, index }: Props) {
  const count = wordCount(a), record = data.records[a.id], saved = data.saved.includes(a.id);
  return <article className={`article-card ${index === 1 ? "lead-article" : ""}`}>
    <button className={`card-cover ${a.kind === "external" ? "has-type-cover" : ""}`} onClick={() => onOpen(a)} aria-label={`阅读 ${a.title}`}>
      {a.kind === "external" ? <div className="type-cover"><span className="type-cover-source"><BookOpen size={18} />READSPACE / READING INDEX</span><strong>{coverTitles[a.topic] || "A WORLD OF IDEAS"}<span>.</span></strong><span className="type-cover-foot">{a.topic}<span>DISCOVER, READ, REMEMBER.</span></span></div> : <img src={a.image} alt="" loading="lazy" />}
      <span className={`level-badge level-${a.level}`}>{a.kind === "external" ? "SOURCE PICK" : a.level === 1 ? "CET-4 · 入门" : a.level === 2 ? "CET-4 · 进阶" : "CET-6 · 拓展"}</span>
      {record?.completedAt && <span className="completed-badge"><Check size={13} />已读</span>}
    </button>
    <button className={`save-button ${saved ? "saved" : ""}`} onClick={() => onSave(a)} aria-label={`${saved ? "取消收藏" : "收藏"} ${a.title}`} aria-pressed={saved}><Bookmark size={18} fill={saved ? "currentColor" : "none"} /></button>
    <div className="card-body">
      <div className="card-topic">{index !== undefined && <b className="article-index">{String(index).padStart(2, "0")}</b>}<span />{a.topic}<span className="card-source">{a.kind === "original" ? "原创训练" : a.source}</span></div>
      <button className="card-title" onClick={() => onOpen(a)}>{a.title}</button>
      {a.subtitle !== a.source && <p className="card-subtitle">{a.subtitle}</p>}
      <p className="card-description">{a.description}</p>
      {a.kind === "external" && a.date && Number.isFinite(Date.parse(a.date)) && <time className="card-published" dateTime={a.date}>原文发布 {publicationDate(a.date)}</time>}
      <div className="card-meta"><span><Clock3 size={14} />{count ? `${readMinutes(a)} min` : "原站阅读"}<span className="meta-dot">·</span>{count ? `${count} words` : `Level ${a.level} · 参考难度`}{record?.completedAt && <span className="card-read-label">已读</span>}</span><button aria-label={`打开 ${a.title}`} onClick={() => onOpen(a)}><ArrowUpRight size={20} /></button></div>
      {record && !record.completedAt && <div className="card-progress"><i style={{ width: `${record.progress}%` }} /></div>}
    </div>
  </article>;
}
