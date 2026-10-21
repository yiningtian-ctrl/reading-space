import { ArticleImporter } from "@/lib/article-import-service.mjs";
import { ArticleImportError } from "@/lib/article-extraction.mjs";
const importer = new ArticleImporter();
const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "请使用 JSON 提交文章链接。" }, { status: 415, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "请从 ReadSpace 页面导入文章。" }, { status: 403, headers });
  try {
    const reader = request.body?.getReader(); if (!reader) throw new ArticleImportError("request", "请提供文章链接。", 400);
    let length = 0, text = ""; const decoder = new TextDecoder();
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 4096) { await reader.cancel(); throw new ArticleImportError("request", "文章链接过长。", 413); } text += decoder.decode(value, { stream: true }); }
    text += decoder.decode();
    let input: { url?: unknown }; try { input = JSON.parse(text); } catch { throw new ArticleImportError("request", "文章链接格式无效。", 400); }
    if (!input || typeof input.url !== "string") throw new ArticleImportError("request", "请提供文章链接。", 400);
    const article = await importer.import(input.url);
    return Response.json({ article }, { headers });
  } catch (e) {
    const error = e instanceof ArticleImportError ? e : new ArticleImportError("unavailable", "正文读取暂时失败，请稍后重试。", 502);
    return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { ...headers, ...(error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) } });
  }
}
