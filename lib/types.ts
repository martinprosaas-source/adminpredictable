export const CATEGORIES = [
  "politique",
  "monde",
  "business",
  "ia",
  "crypto",
  "sport",
  "mma"
] as const;

export type Category = (typeof CATEGORIES)[number];
export type MarketStatus = "open" | "closed" | "unknown" | "pending";
export type Resolution = "yes" | "no" | "pending" | "uncertain";
export type Confidence = "high" | "medium" | "low";

export type Evidence = {
  url: string;
  title: string;
  publishedAt?: string;
  excerpt: string;
  supports: "yes" | "no" | "neutral";
  /** Le fait repond-il exactement a la question du marche (pas un « presque ») ? */
  onTopic?: boolean;
  /** Pourquoi cette source compte ou non pour le marche (1 phrase FR). */
  relevance?: string;
};

export type Market = {
  id: string;
  title: string;
  category: Category;
  url?: string;
  status: MarketStatus;
  resolution: Resolution;
  analysisLabel: string;
  lastAnalysisAt?: string;
  sources: string[];
  confidence?: Confidence;
  evidence?: Evidence[];
  explanationFr?: string;
  /** true = verifier manuellement (cas limite). false = verdict automatique fiable. */
  needsReview?: boolean;
};

export type ImportSummary = {
  imported: number;
  skipped: number;
  total: number;
  byCategory: Record<Category, number>;
};
