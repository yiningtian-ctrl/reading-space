import { curated } from "@/lib/articles";
import { collectFeeds } from "@/lib/article-feeds";
export async function GET() {
  const result = await collectFeeds();
  return Response.json({ ...result, articles: [...result.articles, ...curated] }, { headers: { "Cache-Control": "no-store" } });
}
