import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
export class ArticleImportError extends Error {
  constructor(code, message, status = 422, retryAfter = 0) { super(message); this.code = code; this.status = status; this.retryAfter = retryAfter; }
}
const clean = value => String(value || "").replace(/\u00a0/g, " ").replace(/[\t\r ]+/g, " ").trim();
function gated(value) {
  if (!value || typeof value !== "object") return false;
  const types = [].concat(value["@type"] || []);
  if (types.some(t => /Article|BlogPosting/i.test(String(t))) && [false, "false", "False"].includes(value.isAccessibleForFree)) return true;
  return Object.values(value).some(v => Array.isArray(v) ? v.some(gated) : typeof v === "object" && gated(v));
}
export async function extractPublicArticle(html, url, source) {
  if ((html.match(/<\w+\b/g) || []).length > 18000) throw new ArticleImportError("too_complex", "原文页面结构过于复杂，请改用粘贴正文。");
  const { document } = parseHTML(html);
  Object.defineProperty(document, "documentURI", { value: url, configurable: true });
  Object.defineProperty(document, "baseURI", { value: url, configurable: true });
  for (const element of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { if (gated(JSON.parse(element.textContent))) throw new ArticleImportError("restricted", "原站将这篇文章标为非免费内容，请在原站阅读。"); }
    catch (e) { if (e instanceof ArticleImportError) throw e; }
  }
  const title = clean(document.querySelector('meta[property="og:title"]')?.getAttribute("content") || document.querySelector("h1")?.textContent || document.title || document.querySelector("title")?.textContent);
  if (/just a moment|access denied|verify you are human|robot or human|captcha/i.test(title)) throw new ArticleImportError("challenge", "原站要求访问验证，请打开原文阅读。");
  for (const element of document.querySelectorAll('script,style,noscript,iframe,form,nav,footer,aside,[hidden],[aria-hidden="true"]')) element.remove();
  for (const element of document.querySelectorAll("[style]")) if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(element.getAttribute("style"))) element.remove();
  const result = new Readability(document, { charThreshold: 300, maxElemsToParse: 25000, serializer: element => element }).parse();
  if (!result) throw new ArticleImportError("no_content", "没有找到公开可读的正文，请打开原文或手动粘贴。");
  const paragraphs = [], seen = new Set();
  for (const element of result.content.querySelectorAll("p,h2,h3,h4,blockquote,li,pre")) {
    if (element.querySelector("p,h2,h3,h4,blockquote,li,pre")) continue;
    const text = clean(element.textContent);
    if (text && !seen.has(text)) { seen.add(text); paragraphs.push({ en: text }); }
  }
  if (!paragraphs.length) paragraphs.push(...String(result.textContent || "").split(/\n+/).map(clean).filter(Boolean).map(en => ({ en })));
  const text = paragraphs.map(p => p.en).join("\n\n"), words = (text.match(/[a-z]+(?:['’-][a-z]+)*/gi) || []).length;
  if (words < 80) throw new ArticleImportError("snippet", "只能读取到很短的片段，未将它当作完整正文导入。");
  if (/subscribe to (?:continue|read|unlock)|sign in to continue reading|unlock this article|this article is (?:only |exclusively )?for subscribers/i.test(text)) throw new ArticleImportError("restricted", "原文包含订阅或登录提示，请前往原站阅读。");
  if (text.length > 80000) throw new ArticleImportError("too_long", "正文超过 80,000 字符，请选择部分内容手动导入。");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  const id = `import-web-${Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("").slice(0, 20)}`;
  const stamp = Date.parse(result.publishedTime || "");
  return { id, title: (title || clean(result.title) || "Imported article").slice(0, 220), subtitle: "公开正文提取 · 请对照原文核对", source: source.name, sourceUrl: url, topic: source.topic, level: source.level, kind: "imported", image: "/images/study.jpg", description: "提取自公开可见正文；图表、脚注或部分段落可能遗漏，请保留原文对照。", paragraphs, ...(Number.isFinite(stamp) ? { date: new Date(stamp).toISOString() } : {}) };
}
