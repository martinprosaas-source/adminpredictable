import {
  formatDateFr,
  isBeforeJune2026,
  isJuneOnlyMarketTitle,
  isWithinJune2026,
  JUNE_2026_END,
  parseDateFromIsoString,
  parseDateFromText,
  parseDateFromUrl
} from "./dates";
import type { WebArticle } from "./web-article";
import { Confidence, Evidence, Resolution } from "./types";

const RELEASE_HINT =
  /\b(sort|sortie|release|released|lance|lancement|launch|launched|deploie|unveil|annonce|announced|upgrade|upgrades|nouveau modele|new model|opus|debuts?|debut)\b/i;

const PRODUCT_HINT = /\b(opus|claude|modele|model|gpt|gemini|llama)\b/i;

export type DateRuleResult = {
  resolution: Resolution;
  confidence?: Confidence;
  label: string;
  evidence: Evidence[];
};

function collectArticleDates(articles: WebArticle[]): Date[] {
  const dates: Date[] = [];
  for (const article of articles) {
    if (article.publishedDate) {
      const d = parseDateFromIsoString(article.publishedDate);
      if (d) dates.push(d);
    }
    const fromUrl = parseDateFromUrl(article.url);
    if (fromUrl) dates.push(fromUrl);
    const fromText = parseDateFromText(`${article.title} ${article.content}`);
    if (fromText) dates.push(fromText);
  }
  return dates;
}

function collectEvidenceDates(evidence: Evidence[]): Date[] {
  const dates: Date[] = [];
  for (const e of evidence) {
    if (e.publishedAt) {
      const d = parseDateFromIsoString(e.publishedAt);
      if (d) dates.push(d);
    }
    const fromUrl = parseDateFromUrl(e.url);
    if (fromUrl) dates.push(fromUrl);
    const fromExcerpt = parseDateFromText(e.excerpt);
    if (fromExcerpt) dates.push(fromExcerpt);
  }
  return dates;
}

function articleIsProductRelease(article: WebArticle): boolean {
  const blob = `${article.url} ${article.title} ${article.content}`.toLowerCase();
  return RELEASE_HINT.test(blob) || (PRODUCT_HINT.test(blob) && /\b(upgrade|new|nouveau|opus|debut|release|sort)\b/i.test(blob));
}

function relevantReleaseDates(articles: WebArticle[], evidence: Evidence[]): Date[] {
  const dates: Date[] = [];

  for (const article of articles) {
    const text = `${article.url} ${article.title} ${article.content}`;
    if (!articleIsProductRelease(article)) continue;
    const candidates = [
      article.publishedDate ? parseDateFromIsoString(article.publishedDate) : null,
      parseDateFromUrl(article.url),
      parseDateFromText(text)
    ].filter((d): d is Date => d !== null);
    dates.push(...candidates);
  }

  for (const e of evidence) {
    if (e.supports === "neutral") continue;
    const candidates = [
      e.publishedAt ? parseDateFromIsoString(e.publishedAt) : null,
      parseDateFromUrl(e.url),
      parseDateFromText(e.excerpt)
    ].filter((d): d is Date => d !== null);
    dates.push(...candidates);
  }

  return dates;
}

export function applyMarketDateRules(params: {
  title: string;
  resolution: Resolution;
  confidence?: Confidence;
  label: string;
  evidence: Evidence[];
  articles?: WebArticle[];
  now?: Date;
}): DateRuleResult {
  const { title, evidence, articles = [] } = params;
  let { resolution, confidence, label } = params;
  const now = params.now ?? new Date();

  if (!isJuneOnlyMarketTitle(title)) {
    return { resolution, confidence, label, evidence };
  }

  const releaseDates = relevantReleaseDates(articles, evidence);
  const juneDates = releaseDates.filter(isWithinJune2026);
  const preJuneDates = releaseDates.filter(isBeforeJune2026);

  if (
    preJuneDates.length > 0 &&
    juneDates.length === 0 &&
    (resolution === "yes" || resolution === "uncertain")
  ) {
    const earliest = [...preJuneDates].sort((a, b) => a.getTime() - b.getTime())[0];
    const dateStr = formatDateFr(earliest);
    if (now <= JUNE_2026_END) {
      return {
        resolution: "pending",
        confidence: "medium",
        label: `Evenement hors juin (${dateStr}, ex. mai) — pas de sortie confirmée en juin`,
        evidence
      };
    }
    return {
      resolution: "no",
      confidence: "high",
      label: `Non : aucun evenement en juin (dernier hors periode: ${dateStr})`,
      evidence
    };
  }

  const yesEvidence = evidence.filter((e) => e.supports === "yes");
  const yesPreJune = yesEvidence.filter((e) => {
    const d =
      (e.publishedAt ? parseDateFromIsoString(e.publishedAt) : null) ??
      parseDateFromUrl(e.url) ??
      parseDateFromText(e.excerpt);
    return d ? isBeforeJune2026(d) : false;
  });

  if (resolution === "yes") {
    if (juneDates.length === 0 && (preJuneDates.length > 0 || yesPreJune.length > 0)) {
      const example =
        preJuneDates[0] ?? (yesPreJune[0] ? parseDateFromUrl(yesPreJune[0].url) : null);
      const dateStr = example ? formatDateFr(example) : "mai 2026";
      if (now <= JUNE_2026_END) {
        return {
          resolution: "pending",
          confidence: "medium",
          label: `Evenement hors juin (${dateStr}) — pas de sortie confirmée en juin`,
          evidence
        };
      }
      return {
        resolution: "no",
        confidence: "high",
        label: `Non : seulement des evenements avant juin (${dateStr}), rien en juin`,
        evidence
      };
    }
    if (juneDates.length === 0 && releaseDates.length === 0) {
      return {
        resolution: "pending",
        confidence: confidence ?? "low",
        label: "Oui refuse : aucune date de sortie en juin 2026 verifiable",
        evidence
      };
    }
  }

  const allDates = [...collectArticleDates(articles), ...collectEvidenceDates(evidence)];
  const hasPreJuneOnly =
    allDates.some(isBeforeJune2026) && !allDates.some(isWithinJune2026) && releaseDates.length > 0;

  if (hasPreJuneOnly && resolution === "yes") {
    const earliest = preJuneDates.sort((a, b) => a.getTime() - b.getTime())[0];
    return {
      resolution: "pending",
      confidence: "medium",
      label: `Information avant le 1er juin (${earliest ? formatDateFr(earliest) : "?"}) — ne compte pas pour un marche « en juin »`,
      evidence
    };
  }

  return { resolution, confidence, label, evidence };
}
