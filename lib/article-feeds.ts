import type { Article } from "./reading";
import type { FeedSourceStatus } from "./discovery-types";

type FeedSource = { id: string; name: string; url: string; hosts: string[]; topic: string; level: 2 | 3; image: string; pathPrefixes?: string[]; blockedPaths?: string[]; description?: string };
export const FEED_SOURCES: FeedSource[] = [
  { id: "bbc-education", name: "BBC News · Education", url: "https://feeds.bbci.co.uk/news/education/rss.xml", hosts: ["www.bbc.co.uk", "www.bbc.com"], topic: "校园与成长", level: 3, image: "/images/study.jpg" },
  { id: "bbc-science", name: "BBC News · Science & Environment", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", hosts: ["www.bbc.co.uk", "www.bbc.com"], topic: "环境与生活", level: 3, image: "/images/nature.jpg" },
  { id: "voa-science", name: "VOA Learning English", url: "https://learningenglish.voanews.com/api/zmg_pl-vomx-tpeymtm", hosts: ["learningenglish.voanews.com"], topic: "科技与学习", level: 2, image: "/images/city.jpg" },
  { id: "bne", name: "Breaking News English", url: "https://breakingnewsenglish.com/bne.xml", hosts: ["breakingnewsenglish.com"], topic: "社会与文化", level: 2, image: "/images/study.jpg", description: "时事英语课程；原站可选择不同级别，搭配听力与练习。ReadSpace 难度标签仅供参考，正文可自行粘贴导入。" },
  { id: "science-news", name: "Science News", url: "https://www.sciencenews.org/feed", hosts: ["www.sciencenews.org"], pathPrefixes: ["/article/"], topic: "科技与学习", level: 3, image: "/images/nature.jpg", description: "科学报道，适合拓展真实英文阅读；原站部分内容需订阅。保留原文入口，难度标签仅供参考。" },
  { id: "smithsonian-history", name: "Smithsonian Magazine · History", url: "https://www.smithsonianmag.com/rss/history/", hosts: ["www.smithsonianmag.com"], pathPrefixes: ["/history/"], blockedPaths: ["/sponsored/"], topic: "社会与文化", level: 3, image: "/images/city.jpg", description: "历史与人文阅读，从人物、发现与文化故事拓展视野。保留官方原文，难度标签仅供参考。" },
  { id: "guardian-education", name: "The Guardian · Education", url: "https://www.theguardian.com/education/rss", hosts: ["www.theguardian.com"], blockedPaths: ["/info/", "/help/", "/advertising/"], topic: "校园与成长", level: 3, image: "/images/study.jpg", description: "教育与校园议题的真实英文报道。打开原文阅读，或粘贴正文精读；难度标签仅供参考。" },
];

function articleId(url: URL, source: FeedSource) {
  // Keep legacy IDs so existing saved VOA/BBC articles remain linked.
  if (source.id.startsWith("bbc") || source.id.startsWith("voa")) return `${source.id.startsWith("bbc") ? "bbc" : "voa"}-${url.pathname.split("/").filter(Boolean).pop()}`;
  let hash = 2166136261;
  for (let i = 0; i < url.href.length; i++) hash = Math.imul(hash ^ url.href.charCodeAt(i), 16777619);
  return `${source.id}-${(hash >>> 0).toString(36)}`;
}

function decode(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
    const code = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : parseInt(n, 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  }).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
}

export function parseFeed(xml: string, source: FeedSource, now = Date.now()): Article[] {
  if (xml.length > 2_000_000) throw new Error("Feed too large");
  const seen = new Set<string>();
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap(match => {
    const field = (name: string) => decode(match[1].match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "");
    const title = field("title");
    let url: URL;
    try { url = new URL(field("link")); } catch { return []; }
    if (!title || url.protocol !== "https:" || !source.hosts.includes(url.hostname) || url.username || url.password || url.port || (source.id.startsWith("bbc") && !url.pathname.startsWith("/news/"))) return [];
    if (source.pathPrefixes && !source.pathPrefixes.some(p => url.pathname.startsWith(p))) return [];
    if (source.blockedPaths?.some(p => url.pathname.startsWith(p)) || /^(sponsored|advertisement|advertorial)$/i.test(field("category"))) return [];
    url.search = ""; url.hash = "";
    if (seen.has(url.href)) return [];
    seen.add(url.href);
    const stamp = Date.parse(field("pubDate"));
    // Unknown or future dates are left unlabelled, never presented as today's news.
    const date = Number.isFinite(stamp) && stamp <= now + 300_000 ? new Date(stamp).toISOString() : undefined;
    return [{ id: articleId(url, source), title: title.slice(0, 220), subtitle: source.name, source: source.name, sourceUrl: url.href, topic: source.topic, level: source.level, kind: "external" as const, image: source.image, paragraphs: [], date, description: source.description || `来自 ${source.name} 官方订阅的英文文章。打开原文阅读，或粘贴正文进行查词和批注。难度标签仅供参考。` }];
  }).sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0)).slice(0, 12);
}

export async function collectFeeds(fetcher: typeof fetch = fetch, now = Date.now()) {
  const results = await Promise.all(FEED_SOURCES.map(async source => {
    try {
      const res = await fetcher(source.url, { signal: AbortSignal.timeout(8500), cache: "no-store", headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "ReadSpace/0.1 (RSS reader)" } });
      if (!res.ok) throw new Error("Feed unavailable");
      const articles = parseFeed(await res.text(), source, now);
      if (!articles.length) throw new Error("No valid articles");
      const lastPublishedAt = articles.find(a => a.date)?.date;
      const status: FeedSourceStatus = { id: source.id, name: source.name, url: source.url, status: "ok", count: articles.length, lastPublishedAt, stale: !!lastPublishedAt && now - Date.parse(lastPublishedAt) > 30 * 86400_000 };
      return { articles, status };
    } catch {
      const status: FeedSourceStatus = { id: source.id, name: source.name, url: source.url, status: "error", count: 0 };
      return { articles: [], status };
    }
  }));
  const articles = Array.from(new Map(results.flatMap(r => r.articles).map(a => [a.sourceUrl, a])).values()).sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
  const sources = results.map(r => r.status);
  const good = sources.filter(s => s.status === "ok").length;
  return { articles, sources, status: good === sources.length ? "live" as const : good ? "partial" as const : "fallback" as const, checkedAt: new Date(now).toISOString() };
}
