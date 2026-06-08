import { parseDateFromIsoString, parseDateFromUrl } from "./dates";
import { JUNE_2026_START, getMarketDeadline } from "./temporal";
import { Confidence, Evidence, Resolution } from "./types";

export type VerdictResult = {
  resolution: Resolution;
  confidence: Confidence;
  label: string;
  needsReview: boolean;
  evidence: Evidence[];
};

function isDateInMarketPeriod(date: Date, marketTitle: string): boolean {
  const deadline = getMarketDeadline(marketTitle);
  return date >= JUNE_2026_START && date <= deadline;
}

function evidenceDate(e: Evidence): Date | null {
  if (e.publishedAt) {
    const d = parseDateFromIsoString(e.publishedAt);
    if (d) return d;
  }
  return parseDateFromUrl(e.url);
}

/** Aligne supports avec onTopic : un « oui » hors sujet devient neutre. */
export function sanitizeEvidence(evidence: Evidence[]): Evidence[] {
  return evidence.map((e) => {
    if (e.supports === "yes" && e.onTopic === false) {
      return { ...e, supports: "neutral" as const };
    }
    return e;
  });
}

function isQualifyingYes(e: Evidence, marketTitle: string): boolean {
  if (e.supports !== "yes" || e.onTopic !== true) return false;
  const d = evidenceDate(e);
  return d ? isDateInMarketPeriod(d, marketTitle) : false;
}

function isQualifyingNo(e: Evidence, marketTitle: string): boolean {
  if (e.supports !== "no" || e.onTopic !== true) return false;
  const d = evidenceDate(e);
  return d ? isDateInMarketPeriod(d, marketTitle) : false;
}

export function computeDeterministicVerdict(params: {
  marketTitle: string;
  evidence: Evidence[];
  priorResolution: Resolution;
  priorLabel: string;
}): VerdictResult {
  const evidence = sanitizeEvidence(params.evidence);
  const qualYes = evidence.filter((e) => isQualifyingYes(e, params.marketTitle));
  const qualNo = evidence.filter((e) => isQualifyingNo(e, params.marketTitle));
  const offTopicYes = params.evidence.filter((e) => e.supports === "yes" && e.onTopic === false);
  const yesWithoutDate = evidence.filter(
    (e) => e.supports === "yes" && e.onTopic === true && !evidenceDate(e)
  );

  if (qualYes.length > 0 && qualNo.length > 0) {
    return {
      resolution: "uncertain",
      confidence: "low",
      label: "Sources contradictoires — a valider manuellement",
      needsReview: true,
      evidence
    };
  }

  if (qualYes.length >= 2) {
    return {
      resolution: "yes",
      confidence: "high",
      label:
        params.priorLabel ||
        `Oui confirme : ${qualYes.length} preuves datees en lien avec le marche`,
      needsReview: false,
      evidence
    };
  }

  if (qualYes.length === 1) {
    return {
      resolution: "pending",
      confidence: "medium",
      label: "1 preuve decisive — en attente d'une seconde source independante",
      needsReview: true,
      evidence
    };
  }

  if (offTopicYes.length > 0) {
    return {
      resolution: "pending",
      confidence: "medium",
      label: "Faits en juin trouves mais hors sujet du marche — En attente",
      needsReview: false,
      evidence
    };
  }

  const unvalidatedYes = evidence.filter((e) => e.supports === "yes" && e.onTopic !== true);
  if (unvalidatedYes.length > 0 && qualYes.length === 0) {
    return {
      resolution: "pending",
      confidence: "low",
      label: "Preuves sans lien marche confirme — En attente",
      needsReview: true,
      evidence
    };
  }

  if (yesWithoutDate.length > 0) {
    return {
      resolution: "pending",
      confidence: "low",
      label: "Preuves sans date verifiable dans la periode du marche",
      needsReview: true,
      evidence
    };
  }

  if (qualNo.length >= 2 && params.priorResolution === "no") {
    return {
      resolution: "no",
      confidence: "high",
      label: params.priorLabel || "Non confirme par 2+ preuves datees",
      needsReview: false,
      evidence
    };
  }

  if (evidence.length === 0) {
    return {
      resolution: "pending",
      confidence: "low",
      label: params.priorLabel || "Aucune preuve exploitable",
      needsReview: true,
      evidence
    };
  }

  return {
    resolution: params.priorResolution === "yes" || params.priorResolution === "no" ? "pending" : params.priorResolution,
    confidence: "medium",
    label: params.priorLabel || "Rien de decisif pour l'instant — suivi quotidien",
    needsReview: params.priorResolution === "uncertain",
    evidence
  };
}
