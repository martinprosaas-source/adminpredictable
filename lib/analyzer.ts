import { applyJune2026Rules } from "./temporal";
import { buildExplanationFr } from "./explanation";
import { consolidateExtraction } from "./evidence-rules";
import { analyzeMarketWithOpenAI } from "./openai-analyze";
import { Confidence, Evidence, Market, MarketStatus, Resolution } from "./types";

type AnalysisResult = {
  status: MarketStatus;
  resolution: Resolution;
  sources: string[];
  label: string;
  confidence?: Confidence;
  evidence?: Evidence[];
  explanationFr?: string;
  needsReview?: boolean;
};

function inferFromText(text: string): { status: MarketStatus; resolution: Resolution } {
  const t = text.toLowerCase();
  const hasYes = /(resolved yes|resolved to yes|outcome:?\s*yes|oui|true|confirmed|confirme|approuve|adopte)/i.test(t);
  const hasNo = /(resolved no|resolved to no|outcome:?\s*no|non|false|did not|rejete|annule|refuse)/i.test(t);
  const isClosed = /(closed|resolved|ended|expire|settled|final)/i.test(t);
  const isOpen = /(open|active|trading|ongoing|en cours)/i.test(t);

  const status: MarketStatus = isClosed ? "closed" : isOpen ? "open" : "unknown";
  let resolution: Resolution = "uncertain";
  if (hasYes) resolution = "yes";
  if (hasNo) resolution = "no";
  if (!hasYes && !hasNo) resolution = isClosed ? "pending" : "uncertain";
  return { status, resolution };
}

async function analyzePolymarket(url: string): Promise<Partial<AnalysisResult> | null> {
  try {
    const slug = url.split("/").filter(Boolean).pop();
    if (!slug) return null;
    const endpoint = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`;
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<Record<string, unknown>>;
    const first = data?.[0];
    if (!first) return null;
    const stateText = JSON.stringify(first);
    const inferred = inferFromText(stateText);
    const closed = inferred.status === "closed";
    const decisive = inferred.resolution === "yes" || inferred.resolution === "no";
    return {
      ...inferred,
      sources: [url, endpoint].slice(0, 3),
      confidence: closed && decisive ? "high" : "medium",
      label: closed && decisive ? "Donnees Polymarket" : "Polymarket — resultat non decisif"
    };
  } catch {
    return null;
  }
}

async function analyzeWithOpenAI(market: Market): Promise<Partial<AnalysisResult>> {
  const { result, articles, error } = await analyzeMarketWithOpenAI(market.title, market.url);

  if (result) {
    const consolidated = consolidateExtraction(result, market.title, articles);
    return {
      status: consolidated.status,
      resolution: consolidated.resolution,
      sources: consolidated.sources.length
        ? consolidated.sources
        : articles.map((a) => a.url).slice(0, 5),
      label: consolidated.label,
      confidence: consolidated.confidence,
      evidence: consolidated.evidence,
      explanationFr: consolidated.explanationFr,
      needsReview: consolidated.needsReview
    };
  }

  return {
    status: "open",
    resolution: "pending",
    label: error ?? "Analyse OpenAI impossible",
    confidence: "low",
    evidence: [],
    sources: market.sources,
    needsReview: true
  };
}

export async function analyzeMarket(market: Market): Promise<Market> {
  let base: Partial<AnalysisResult> = {};
  if (market.url && /polymarket\.com/i.test(market.url)) {
    base = (await analyzePolymarket(market.url)) ?? {};
  }
  const polymarketDecisive =
    base.confidence === "high" && (base.resolution === "yes" || base.resolution === "no");

  if (!polymarketDecisive) {
    base = { ...base, ...(await analyzeWithOpenAI(market)) };
  }

  const status = base.status ?? "unknown";
  let resolution = base.resolution ?? "uncertain";
  const confidence = base.confidence;
  const evidence = base.evidence ?? [];

  const temporal = applyJune2026Rules({
    title: market.title,
    status,
    resolution,
    label: base.label ?? ""
  });
  resolution = temporal.resolution;
  const finalLabel = temporal.label;
  const explanationFr = buildExplanationFr({
    title: market.title,
    resolution,
    confidence,
    analysisLabel: finalLabel,
    evidence,
    explanationFr: base.explanationFr
  });

  return {
    ...market,
    status: temporal.status,
    resolution,
    analysisLabel: finalLabel,
    sources: (base.sources?.length ? base.sources : market.sources).slice(0, 5),
    confidence,
    evidence,
    explanationFr,
    needsReview: base.needsReview ?? true,
    lastAnalysisAt: new Date().toISOString()
  };
}
