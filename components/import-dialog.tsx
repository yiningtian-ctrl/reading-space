"use client";
import { useState } from "react";
import { ArrowRight, FileText, Link2 } from "lucide-react";
import { Modal } from "./reading-ui";
import ArticleImport from "./article-import";
import type { Article } from "@/lib/reading";
import { safeUrl } from "@/lib/reading";
import { normalizeArticleUrl } from "@/lib/article-import-policy.mjs";

type Props = { initialArticle?: Article; imported: Article[]; onClose: () => void; onImport: (a: Article) => void };
export default function ImportDialog({ initialArticle, imported, onClose, onImport }: Props) {
  const [mode, setMode] = useState("text"), [title, setTitle] = useState(initialArticle?.kind === "external" ? initialArticle.title : ""), [url, setUrl] = useState(initialArticle?.sourceUrl || ""), [text, setText] = useState(""), [topic, setTopic] = useState("校园与成长"), [level, setLevel] = useState(2), [error, setError] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!title.trim()) { setError("为文章起一个标题吧。"); return; }
    if (mode === "text" && !text.trim()) { setError("请先粘贴英文正文。"); return; }
    if (url.trim() && !safeUrl(url.trim()) || mode === "link" && !safeUrl(url.trim())) { setError("请输入完整的 http 或 https 链接。"); return; }
    if (text.length > 80000) { setError("单篇正文请控制在 80,000 字符以内。"); return; }
    const paragraphs = text.trim() ? text.trim().split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean).map(en => ({ en })) : [];
    onImport({ id: `import-${crypto.randomUUID()}`, title: title.trim(), subtitle: "我的个人阅读", topic, level: level as 1 | 2 | 3, source: "个人导入", sourceUrl: safeUrl(url.trim()), kind: "imported", image: "/images/study.jpg", description: paragraphs.length ? paragraphs[0].en.slice(0, 130) : "已收藏原文链接，稍后可以补充正文。", paragraphs, date: new Date().toISOString() });
  };
  const normalized = normalizeArticleUrl(url);
  const existing = normalized ? imported.find(a => a.paragraphs.length > 0 && normalizeArticleUrl(a.sourceUrl) === normalized) : undefined;
  return <Modal title="给好文章，一个自己的位置。" eyebrow="BRING YOUR OWN READING" onClose={onClose} wide>
    <div className="dialog-tabs"><button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}><FileText size={15} />粘贴正文</button><button className={mode === "auto" ? "active" : ""} onClick={() => setMode("auto")}><FileText size={15} />读取链接</button><button className={mode === "link" ? "active" : ""} onClick={() => setMode("link")}><Link2 size={15} />收藏链接</button></div>
    <p className="modal-description">{mode === "text" ? "保留原文分段，开始查词、高亮与批注。个人文章的解析和译文暂不自动生成。" : mode === "auto" ? "粘贴支持来源的公开文章链接，直接导入精读空间。" : "先把原文链接收好，随时可以补充正文。"}</p>
    {mode === "auto" ? <><label className="field">原文链接<input type="url" value={url} onChange={e => setUrl(e.target.value)} maxLength={2000} placeholder="https://…" /></label><ArticleImport key={url} url={url.trim()} existing={existing} onImported={onImport} onPaste={() => setMode("text")} /></> : <form onSubmit={submit}>
      <label className="field">文章标题 <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What would you like to read?" maxLength={220} required /></label>
      <label className="field">原文链接 <span className="optional">{mode === "text" ? "选填" : "必填"}</span><input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" required={mode === "link"} /></label>
      <div className="field-row"><label className="field">主题<select value={topic} onChange={e => setTopic(e.target.value)}>{["校园与成长", "科技与学习", "社会与文化", "环境与生活"].map(t => <option key={t}>{t}</option>)}</select></label><label className="field">难度标签<select value={level} onChange={e => setLevel(Number(e.target.value))}><option value={1}>Level 1 · 四级入门</option><option value={2}>Level 2 · 四级进阶</option><option value={3}>Level 3 · 六级拓展</option></select></label></div>
      <label className="field">英文正文 <span className="optional">{mode === "text" ? "必填" : "选填，添加后可直接精读"}</span><textarea rows={7} value={text} onChange={e => setText(e.target.value)} placeholder="Paste your article here…" maxLength={80000} required={mode === "text"} /><span className="field-count">{text.trim().match(/\b[a-z]+\b/gi)?.length || 0} words · 仅保存在当前浏览器</span></label>
      {error && <p role="alert" className="form-error">{error}</p>}<button className="button primary full" type="submit">{text.trim() ? "导入并开始阅读" : "保存到我的图书馆"}<ArrowRight size={16} /></button>
    </form>}
  </Modal>;
}
