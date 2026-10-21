import { RefreshCw } from "lucide-react";
import type { DiscoveryResponse } from "@/lib/discovery-types";

export function publicationDate(date: string) {
  return new Date(date).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function FeedStatus({ status, sources, checkedAt, loading, error, newCount, refresh }: DiscoveryResponse & { loading: boolean; error: boolean; newCount: number; refresh: () => void }) {
  return <div className="feed-status">
    <div className="feed-status-top"><div aria-live="polite"><strong><span className={`feed-dot ${error ? "offline" : ""}`} />{loading ? "正在检查官方订阅…" : error ? "连接暂不可用，保留已有文章" : status === "partial" ? "部分来源暂不可用，保留上次文章" : "官方订阅 · 按原文发布时间排序"}</strong><p><span className="feed-schedule-full">打开时检查 · 使用期间每 5 分钟检查{checkedAt && <> · 最近成功检查 {publicationDate(checkedAt)}</>}</span><span className="feed-schedule-short">每 5 分钟自动检查</span>{newCount > 0 && <b> · 发现 {newCount} 篇新文章</b>}</p></div><button className="text-button" disabled={loading} onClick={refresh}><RefreshCw size={14} className={loading ? "spin" : ""} />{loading ? "检查中" : "立即刷新"}</button></div>
    <details><summary>订阅来源与更新情况 <span>{sources.length ? `${sources.filter(s => s.status === "ok").length} / ${sources.length} 已连接` : "等待检查"}</span></summary>{checkedAt && <p>最近成功检查 {publicationDate(checkedAt)}</p>}<ul>{sources.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a><span>{s.status === "error" ? "暂时无法连接" : `${s.count} 篇 · ${s.lastPublishedAt ? `最新原文 ${publicationDate(s.lastPublishedAt)}` : "未提供发布时间"}`}{s.stale && " · 来源近期未更新"}</span></li>)}</ul><p>RSS 随原站发布更新，不保证每次检查都有新文章。时间按你的设备时区显示。</p></details>
  </div>;
}
