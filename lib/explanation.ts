import type { Confidence, Evidence, Market, Resolution } from "./types";

const resolutionVerdict: Record<Resolution, string> = {
  yes: "Oui — l'événement du marché est confirmé par des preuves datées et en lien avec la question.",
  no: "Non — l'événement n'est pas réalisé dans la période du marché.",
  pending:
    "En attente — le marché reste ouvert ; analyse quotidienne jusqu'à la fin de la période.",
  uncertain: "Incertain — les sources se contredisent ou ne permettent pas de trancher."
};

const confidenceText: Record<Confidence, string> = {
  high: "verdict automatique fiable",
  medium: "verdict probable — relecture rapide conseillée",
  low: "verdict fragile"
};

function formatDateFr(iso?: string): string {
  if (!iso) return "date non précisée";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function buildExplanationFr(
  market: Pick<
    Market,
    "title" | "resolution" | "confidence" | "analysisLabel" | "evidence" | "explanationFr" | "needsReview"
  >
): string {
  if (market.explanationFr?.trim()) {
    let footer = "";
    if (market.needsReview === true) {
      footer = "\n\nCe marche est marque « A valider » — relecture admin recommandee.";
    } else if (market.needsReview === false) {
      footer = "\n\nVerdict automatique fiable : pas de relecture necessaire.";
    }
    return market.explanationFr.trim() + footer;
  }

  const conf = market.confidence ? confidenceText[market.confidence] : "confiance non évaluée";
  const parts: string[] = [
    `Marché : « ${market.title} »`,
    resolutionVerdict[market.resolution],
    `Niveau : ${conf}.`,
    market.analysisLabel ? `Synthèse : ${market.analysisLabel}` : ""
  ];

  const evidence = market.evidence ?? [];
  if (evidence.length > 0) {
    parts.push("", "Sources :");
    for (const e of evidence) {
      const topic =
        e.onTopic === true ? "en lien avec le marché" : e.onTopic === false ? "hors sujet" : "lien non précisé";
      parts.push(
        `• ${supportsLabelFr(e.supports)} (${topic}) — ${e.title} (${formatDateFr(e.publishedAt)}) : ${e.excerpt}`
      );
      if (e.relevance) parts.push(`  → ${e.relevance}`);
    }
  }

  return parts.filter(Boolean).join("\n");
}

export function supportsLabelFr(supports: Evidence["supports"]): string {
  if (supports === "yes") return "Pour le Oui";
  if (supports === "no") return "Pour le Non";
  return "Neutre";
}

export function onTopicLabelFr(onTopic?: boolean): string {
  if (onTopic === true) return "Lien marché : Oui";
  if (onTopic === false) return "Lien marché : Non";
  return "Lien marché : ?";
}
