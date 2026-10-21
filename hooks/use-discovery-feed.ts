"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { curated } from "@/lib/articles";
import { FEED_REFRESH_MS, isDiscoveryResponse } from "@/lib/discovery-types";
import type { DiscoveryResponse } from "@/lib/discovery-types";

const cacheKey = "readspace.discover.v2";
const initial: DiscoveryResponse = { articles: curated, status: "fallback", sources: [], checkedAt: "" };

export function useDiscoveryFeed(enabled: boolean) {
  const [result, setResult] = useState(initial);
  const [loading, setLoading] = useState(false), [error, setError] = useState(false), [newCount, setNewCount] = useState(0);
  const current = useRef(initial), pending = useRef<AbortController | null>(null), lastAttempt = useRef(0), initialized = useRef(false);
  useEffect(() => {
    try {
      const cached: unknown = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (isDiscoveryResponse(cached)) { current.current = cached; setResult(cached); initialized.current = true; }
    } catch { /* A feed cache must never interrupt study records. */ }
  }, []);
  const refresh = useCallback(async () => {
    if (pending.current || document.visibilityState === "hidden") return;
    const controller = new AbortController(); pending.current = controller; lastAttempt.current = Date.now();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    setLoading(true);
    try {
      const res = await fetch("/api/discover?v=2", { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error("Feed unavailable");
      const incoming: unknown = await res.json();
      if (controller.signal.aborted || pending.current !== controller) return;
      if (!isDiscoveryResponse(incoming)) throw new Error("Invalid feed");
      if (incoming.status === "fallback") throw new Error("All sources unavailable");
      const previous = current.current;
      const known = new Set(previous.articles.map(a => a.sourceUrl));
      const failed = new Set(incoming.sources.filter(s => s.status === "error").map(s => s.name));
      const retained = previous.articles.filter(a => failed.has(a.source));
      const combined = Array.from(new Map([...incoming.articles, ...retained].map(a => [a.sourceUrl, a])).values()).sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
      const next = { ...incoming, articles: combined };
      setNewCount(initialized.current ? incoming.articles.filter(a => a.date && !known.has(a.sourceUrl)).length : 0);
      initialized.current = true; current.current = next; setResult(next); setError(false);
      try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Best-effort cache only. */ }
    } catch {
      if (pending.current === controller) setError(true);
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; setLoading(false); }
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const interval = setInterval(() => { void refresh(); }, FEED_REFRESH_MS);
    const resume = () => { if (Date.now() - lastAttempt.current >= 60_000) void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume); window.addEventListener("online", resume); window.addEventListener("pageshow", resume);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume); window.removeEventListener("online", resume); window.removeEventListener("pageshow", resume);
      const request = pending.current; pending.current = null; request?.abort(); setLoading(false);
    };
  }, [enabled, refresh]);
  return { ...result, loading, error, newCount, refresh };
}
