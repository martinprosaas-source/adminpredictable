import { parseDateFromUrl } from "./dates";

/** Source web citee par l'analyse (OpenAI web search). */
export type WebArticle = {
  url: string;
  title: string;
  content: string;
  publishedDate?: string;
};

export function webArticleFromCitation(url: string, title: string, snippet = ""): WebArticle {
  const fromUrl = parseDateFromUrl(url);
  return {
    url,
    title: title || url,
    content: snippet,
    publishedDate: fromUrl ? fromUrl.toISOString().slice(0, 10) : undefined
  };
}

export function uniqueArticles(articles: WebArticle[]): WebArticle[] {
  const seen = new Set<string>();
  const out: WebArticle[] = [];
  for (const a of articles) {
    if (!a.url || seen.has(a.url)) continue;
    seen.add(a.url);
    out.push(a);
  }
  return out.slice(0, 8);
}
