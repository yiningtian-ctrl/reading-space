"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, LoaderCircle } from "lucide-react";
import { articleImportPolicy } from "@/lib/article-import-policy.mjs";
import { defaultData, validateData } from "@/lib/reading";
import type { Article } from "@/lib/reading";

type Props = { url: string; existing?: Article; onImported: (article: Article) => void; onPaste?: () => void };
function validArticle(value: unknown): value is Article {
  return validateData({ ...defaultData, imported: [value] }) && (value as Article).kind === "imported" && (value as Article).paragraphs.length > 0 && (value as Article).paragraphs.reduce((n, p) => n + p.en.length, 0) <= 80000;
}
export default function ArticleImport({ url, existing, onImported, onPaste }: Props) {
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null), policy = articleImportPolicy(url);
  useEffect(() => { setError(""); setLoading(false); return () => { pending.current?.abort(); pending.current = null; }; }, [url]);
  const load = async () => {
    if (existing) { onImported(existing); return; }
    if (!policy.supported || pending.current) return;
    const controller = new AbortController(); pending.current = controller; setLoading(true); setError("");
    const timer = setTimeout(() => controller.abort(), 22000);
    try {
      const response = await fetch("/api/article-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: policy.url }), signal: controller.signal });
      const result: { article?: unknown; error?: unknown } = await response.json();
      if (controller.signal.aborted || pending.current !== controller) return;
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "暂时无法读取正文，请打开原文或手动粘贴。");
      if (!validArticle(result.article)) throw new Error("未收到有效正文，请打开原文或手动粘贴。");
      onImported(result.article);
    } catch (e) {
      if (pending.current === controller) setError(controller.signal.aborted ? "正文读取超时，请稍后重试或手动粘贴。" : e instanceof Error ? e.message : "连接失败，请稍后重试。");
    } finally { clearTimeout(timer); if (pending.current === controller) { pending.current = null; setLoading(false); } }
  };
  return <section className="article-import-panel" aria-label="公开正文导入">
    <div className="article-import-heading"><FileText size={19} /><div><strong>{existing ? "这篇文章已经在你的精读空间" : "把公开正文带进阅读器"}</strong><p>{existing ? "继续使用已有文章和批注。" : policy.reason}</p></div></div>
    {(existing || policy.supported) && <button className="button primary" onClick={load} disabled={loading}>{loading ? <LoaderCircle size={17} className="spin" /> : <FileText size={17} />}{existing ? "继续精读已导入文章" : loading ? "正在读取公开正文…" : "读取正文并精读"}{!loading && <ArrowRight size={16} />}</button>}
    {error && <div className="article-import-error" role="alert"><p>{error}</p>{onPaste && <button className="text-button" onClick={onPaste}>改为粘贴正文<ArrowRight size={15} /></button>}</div>}
    {(existing || policy.supported) && <p className="article-import-footnote">正文保存在当前浏览器。提取可能遗漏图表或部分段落，请对照原文核对。</p>}
  </section>;
}
