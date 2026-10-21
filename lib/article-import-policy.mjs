const sources = [
  { name: "VOA Learning English", host: "learningenglish.voanews.com", path: /^\/a\/(?:[a-z0-9-]+\/)?\d+\.html$/, topic: "科技与学习", level: 2 },
  { name: "Science News", host: "www.sciencenews.org", path: /^\/article\/[a-z0-9-]+\/?$/, topic: "科技与学习", level: 3 },
  { name: "Smithsonian Magazine", host: "www.smithsonianmag.com", path: /^\/(?:history|science-nature|smart-news|arts-culture|innovation|travel)\/[a-z0-9-]+-\d+\/?$/, topic: "社会与文化", level: 3 },
  { name: "The Guardian", host: "www.theguardian.com", path: /^\/[a-z-]+\/\d{4}\/[a-z]{3}\/\d{1,2}\/[a-z0-9-]+\/?$/, topic: "校园与成长", level: 3 },
];
export function normalizeArticleUrl(value) {
  if (typeof value !== "string" || value.length > 2000) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return undefined;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || ["fbclid", "gclid"].includes(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return undefined; }
}
export function articleImportPolicy(value) {
  const canonical = normalizeArticleUrl(value);
  if (!canonical) return { supported: false, reason: "请输入完整的 HTTPS 文章链接。" };
  const url = new URL(canonical);
  if (["www.bbc.com", "www.bbc.co.uk", "bbc.com", "bbc.co.uk"].includes(url.hostname)) return { supported: false, reason: "BBC 当前仅提供原文入口，请前往原站阅读，或手动粘贴有权使用的正文。" };
  if (url.hostname === "breakingnewsenglish.com") return { supported: false, reason: "Breaking News English 当前不支持自动转存，请前往原站阅读。" };
  const source = sources.find(s => s.host === url.hostname && s.path.test(url.pathname));
  if (!source) return { supported: false, reason: "当前支持 VOA、Science News、Smithsonian 和 The Guardian 的公开文章；其他来源可手动粘贴正文。" };
  return { supported: true, url: canonical, source, reason: "提取公开可见正文，导入后可查词、高亮和批注。" };
}
