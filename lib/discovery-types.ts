import type { Article } from "./reading";

export type FeedSourceStatus = { id: string; name: string; url: string; status: "ok" | "error"; count: number; lastPublishedAt?: string; stale?: boolean };
export type DiscoveryResponse = { articles: Article[]; status: "live" | "partial" | "fallback"; sources: FeedSourceStatus[]; checkedAt: string };
export const FEED_REFRESH_MS = 5 * 60 * 1000;

// Feed cache is separate from learning records and is never included in a backup.
export function isDiscoveryResponse(value: unknown): value is DiscoveryResponse {
  if (!value || typeof value !== "object") return false;
  const d = value as DiscoveryResponse;
  return ["live", "partial", "fallback"].includes(d.status) && typeof d.checkedAt === "string" && Number.isFinite(Date.parse(d.checkedAt)) &&
    Array.isArray(d.sources) && d.sources.length <= 10 && d.sources.every(s => s && typeof s.id === "string" && typeof s.name === "string" && typeof s.url === "string" && ["ok", "error"].includes(s.status) && typeof s.count === "number") &&
    Array.isArray(d.articles) && d.articles.length <= 100 && d.articles.every(a => {
      if (!a || a.kind !== "external" || typeof a.id !== "string" || typeof a.title !== "string" || typeof a.subtitle !== "string" || typeof a.description !== "string" || typeof a.topic !== "string" || typeof a.source !== "string" || ![1, 2, 3].includes(a.level) || !Array.isArray(a.paragraphs) || a.paragraphs.length || typeof a.image !== "string" || !a.image.startsWith("/images/")) return false;
      try { const u = new URL(a.sourceUrl || ""); return u.protocol === "https:" && !u.username && !u.password && !u.port && ["learningenglish.voanews.com", "www.bbc.co.uk", "www.bbc.com", "learnenglish.britishcouncil.org", "breakingnewsenglish.com", "www.sciencenews.org", "www.smithsonianmag.com", "www.theguardian.com", "www.chinadaily.com.cn", "global.chinadaily.com.cn"].includes(u.hostname); } catch { return false; }
    });
}
