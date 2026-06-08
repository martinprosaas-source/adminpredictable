import type { ExtractionResult } from "./openai-analyze";
import { applyMarketDateRules } from "./market-dates";
import { computeDeterministicVerdict } from "./verdict";
import type { WebArticle } from "./web-article";
import { Confidence, Evidence, MarketStatus, Resolution } from "./types";

export type ConsolidatedAnalysis = {
  status: MarketStatus;
  resolution: Resolution;
  confidence: Confidence;
  label: string;
  explanationFr: string;
  evidence: Evidence[];
  sources: string[];
  needsReview: boolean;
};

export function consolidateExtraction(
  extraction: ExtractionResult,
  marketTitle: string,
  articles: WebArticle[] = []
): ConsolidatedAnalysis {
  let evidence = extraction.evidence;
  const sources = [...new Set(evidence.map((e) => e.url))].slice(0, 5);
  let explanationFr = extraction.explanationFr;
  const status = "open";

  const dated = applyMarketDateRules({
    title: marketTitle,
    resolution: extraction.resolution,
    confidence: extraction.confidence,
    label: extraction.label,
    evidence,
    articles
  });

  if (dated.label !== extraction.label && dated.label) {
    explanationFr = explanationFr
      ? `${explanationFr}\n\nMise a jour : ${dated.label}`
      : dated.label;
  }

  evidence = dated.evidence;

  const verdict = computeDeterministicVerdict({
    marketTitle,
    evidence,
    priorResolution: dated.resolution,
    priorLabel: dated.label
  });

  return {
    status,
    resolution: verdict.resolution,
    confidence: verdict.confidence,
    label: verdict.label,
    explanationFr,
    evidence: verdict.evidence,
    sources,
    needsReview: verdict.needsReview
  };
}
