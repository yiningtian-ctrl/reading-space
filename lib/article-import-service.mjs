import robotsParser from "robots-parser";
import { articleImportPolicy } from "./article-import-policy.mjs";
import { ArticleImportError, extractPublicArticle } from "./article-extraction.mjs";
const agent = "ReadSpace/0.2 (personal reading)";

export class ArticleImporter {
  constructor({ fetcher = fetch, clock = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    this.fetcher = fetcher; this.clock = clock; this.wait = wait; this.robots = new Map(); this.states = new Map();
  }
  async read(value, robots = false, signal = AbortSignal.timeout(20000)) {
    let url = new URL(value);
    const origin = url.origin;
    for (let hop = 0; hop < 4; hop++) {
      if (url.origin !== origin || url.username || url.password || url.port || url.protocol !== "https:" || (robots ? url.pathname !== "/robots.txt" : !articleImportPolicy(url.href).supported)) throw new ArticleImportError("redirect", "原站跳转到不支持的地址，请直接打开原文。");
      if (!robots && this.robots.get(origin)?.parser.isAllowed(url.href, agent) === false) throw new ArticleImportError("robots", "原站不允许自动读取这个地址，请打开原文。");
      const response = await this.fetcher(url.href, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), redirect: "manual", cache: "no-store", headers: { "User-Agent": agent, Accept: robots ? "text/plain" : "text/html, application/xhtml+xml" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location"); await response.body?.cancel();
        if (!location) throw new ArticleImportError("redirect", "原文跳转失败，请打开原文。");
        url = new URL(location, url); continue;
      }
      if (robots && [404, 410].includes(response.status)) { await response.body?.cancel(); return { text: "", url: url.href }; }
      if (!response.ok) {
        await response.body?.cancel();
        const retry = response.headers.get("retry-after");
        const retrySeconds = /^\d+$/.test(retry || "") ? Number(retry) : Math.ceil((Date.parse(retry || "") - this.clock()) / 1000);
        throw new ArticleImportError("upstream_restricted", `原站返回 HTTP ${response.status}，暂时无法读取正文。请打开原文，或稍后重试。`, 422, [401, 403, 429].includes(response.status) ? Math.max(60, Math.min(3600, Number.isFinite(retrySeconds) ? retrySeconds : 60)) : 0);
      }
      const max = robots ? 500000 : 1500000;
      if (Number(response.headers.get("content-length")) > max) { await response.body?.cancel(); throw new ArticleImportError("too_large", "原文页面过大，请改用手动粘贴。"); }
      const contentType = response.headers.get("content-type") || "";
      if (!robots && !/text\/html|application\/xhtml\+xml/i.test(contentType)) { await response.body?.cancel(); throw new ArticleImportError("content_type", "这个链接不是可读取的 HTML 文章。"); }
      const reader = response.body?.getReader(); if (!reader) throw new ArticleImportError("empty", "原站未返回正文。");
      let bytes = 0; const parts = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > max) { await reader.cancel(); throw new ArticleImportError("too_large", "原文页面过大，请改用手动粘贴。"); } parts.push(value); }
      const combined = new Uint8Array(bytes); let offset = 0; for (const part of parts) { combined.set(part, offset); offset += part.byteLength; }
      return { text: new TextDecoder().decode(combined), url: url.href };
    }
    throw new ArticleImportError("redirect", "原站跳转次数过多，请打开原文。");
  }
  async import(value) {
    const policy = articleImportPolicy(value);
    if (!policy.supported) throw new ArticleImportError("unsupported", policy.reason);
    const origin = new URL(policy.url).origin;
    const state = this.states.get(origin) || { active: false, next: 0 };
    if (state.active || state.next > this.clock()) throw new ArticleImportError("busy", "这个来源刚刚读取过，请稍后再试。", 429, Math.max(3, Math.ceil((state.next - this.clock()) / 1000)));
    this.states.set(origin, state); state.active = true;
    const signal = AbortSignal.timeout(20000);
    let delay = 3000;
    try {
      let rules = this.robots.get(origin);
      if (!rules || this.clock() - rules.checkedAt > 3600000) {
        const result = await this.read(`${origin}/robots.txt`, true, signal);
        if (/^\s*(?:<!doctype html|<html)/i.test(result.text) || !/^\s*(?:user-agent|sitemap|allow|disallow|crawl-delay)\s*:/im.test(result.text) && result.text.trim() && /<[^>]+>/.test(result.text)) throw new ArticleImportError("robots", "无法确认原站访问规则，请打开原文阅读。");
        const parser = robotsParser(`${origin}/robots.txt`, result.text);
        rules = { parser, delay: Math.max(3000, Number(parser.getCrawlDelay(agent) || 0) * 1000), checkedAt: this.clock() };
        this.robots.set(origin, rules); delay = rules.delay;
        if (!parser.isAllowed(policy.url, agent)) throw new ArticleImportError("robots", "原站不允许自动读取这篇文章，请打开原文。");
        if (delay > 8000) throw new ArticleImportError("busy", "原站要求较长访问间隔，请稍后重试或打开原文。", 429, Math.ceil(delay / 1000));
        await this.wait(delay);
      }
      delay = rules.delay;
      if (!rules.parser.isAllowed(policy.url, agent)) throw new ArticleImportError("robots", "原站不允许自动读取这篇文章，请打开原文。");
      const page = await this.read(policy.url, false, signal);
      return await extractPublicArticle(page.text, page.url, policy.source);
    } catch (e) {
      if (e instanceof ArticleImportError) { if (e.retryAfter) delay = Math.max(delay, e.retryAfter * 1000); throw e; }
      throw new ArticleImportError("unavailable", "正文读取暂时失败，请打开原文，或稍后重试。", 502);
    } finally { state.active = false; state.next = this.clock() + delay; }
  }
}
