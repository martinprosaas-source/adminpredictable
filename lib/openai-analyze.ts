import { getOpenAIKey, getOpenAIModel } from "./env";
import { Confidence, Evidence, MarketStatus, Resolution } from "./types";
import { uniqueArticles, webArticleFromCitation, type WebArticle } from "./web-article";

export type ExtractionResult = {
  status: MarketStatus;
  resolution: Resolution;
  confidence: Confidence;
  label: string;
  explanationFr: string;
  evidence: Evidence[];
};

const VALID_STATUS = new Set<MarketStatus>(["open", "closed", "unknown", "pending"]);
const VALID_RESOLUTION = new Set<Resolution>(["yes", "no", "pending", "uncertain"]);
const VALID_CONFIDENCE = new Set<Confidence>(["high", "medium", "low"]);
const VALID_SUPPORTS = new Set<Evidence["supports"]>(["yes", "no", "neutral"]);

const ANALYST_SYSTEM = `Tu es un analyste factuel pour des marches de prediction (echeance juin 2026).
Utilise la recherche web pour trouver des sources recentes et fiables (presse, sites officiels).

REGLE D'OR: la question EXACTE du marche fait loi. Un fait « proche » mais hors sujet ne compte PAS.
Exemples:
- « actualite politique americaine » : elections, gouvernement, Trump, Congres, lois — PAS une IPO SpaceX ni un accord SEC boursier sauf lien politique explicite.
- « nouvelle fonctionnalite majeure » : annonce produit significative — PAS un petit tweak UI.
- « en juin 2026 » : evenement en mai = hors periode, onTopic false si presente comme preuve du marche.

Pour CHAQUE preuve:
- onTopic (true/false): le fait repond-il EXACTEMENT a la question du marche ?
- relevance: 1 phrase FR expliquant le lien (ou pourquoi hors sujet).
- supports: "yes" seulement si onTopic true ET le fait soutient Oui; sinon "neutral" ou "no".
- publishedAt obligatoire si connue (YYYY-MM-DD). Verifie l'URL (/2026/06/...).

Resolution:
- "yes" si tu as 2+ preuves onTopic true, datees en juin, supports yes, independantes.
- "pending" si pas assez de preuves ou hors sujet — JAMAIS "yes" avec preuves hors sujet.
- AVANT fin juin: status "open". Pas "closed".

Reponds UNIQUEMENT en JSON:
{"status":"open","resolution":"yes|no|pending|uncertain","confidence":"high|medium|low","label":"phrase courte FR","explanation":"3-5 phrases FR","evidence":[{"url":"https://...","title":"...","publishedAt":"YYYY-MM-DD","excerpt":"...","supports":"yes|no|neutral","onTopic":true,"relevance":"..."}]}`;

function parseJsonBlock(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(raw.slice(start, end + 1));
  }
  return JSON.parse(raw);
}

function normalizeExtraction(raw: unknown): ExtractionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const status = o.status as MarketStatus;
  const resolution = o.resolution as Resolution;
  const confidence = o.confidence as Confidence;
  const label = typeof o.label === "string" ? o.label.slice(0, 400) : "";
  const explanationFr =
    typeof o.explanation === "string"
      ? o.explanation.slice(0, 1200)
      : typeof o.explanationFr === "string"
        ? o.explanationFr.slice(0, 1200)
        : "";

  if (!VALID_STATUS.has(status) || !VALID_RESOLUTION.has(resolution) || !VALID_CONFIDENCE.has(confidence)) {
    return null;
  }

  const evidence: Evidence[] = [];
  if (Array.isArray(o.evidence)) {
    for (const item of o.evidence) {
      if (!item || typeof item !== "object") continue;
      const e = item as Record<string, unknown>;
      const url = typeof e.url === "string" ? e.url : "";
      const title = typeof e.title === "string" ? e.title : "";
      const excerpt = typeof e.excerpt === "string" ? e.excerpt.slice(0, 500) : "";
      const supports = e.supports as Evidence["supports"];
      if (!url || !excerpt || !VALID_SUPPORTS.has(supports)) continue;
      const onTopic =
        typeof e.onTopic === "boolean"
          ? e.onTopic
          : supports === "yes"
            ? undefined
            : true;
      evidence.push({
        url,
        title: title || url,
        excerpt,
        supports,
        publishedAt: typeof e.publishedAt === "string" ? e.publishedAt : undefined,
        onTopic,
        relevance: typeof e.relevance === "string" ? e.relevance.slice(0, 300) : undefined
      });
    }
  }

  return {
    status,
    resolution,
    confidence,
    label: label || "Analyse OpenAI",
    explanationFr,
    evidence: evidence.slice(0, 5)
  };
}

function extractTextFromResponses(data: Record<string, unknown>): string {
  const chunks: string[] = [];
  const output = data.output;
  if (!Array.isArray(output)) {
    const legacy = data as { choices?: Array<{ message?: { content?: string } }> };
    return legacy.choices?.[0]?.message?.content ?? "";
  }

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const block = item as Record<string, unknown>;
    if (block.type !== "message") continue;
    const content = block.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") {
        chunks.push(p.text);
      }
    }
  }
  return chunks.join("\n");
}

function extractCitationsFromResponses(data: Record<string, unknown>): WebArticle[] {
  const articles: WebArticle[] = [];
  const output = data.output;
  if (!Array.isArray(output)) return articles;

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const block = item as Record<string, unknown>;
    if (block.type !== "message") continue;
    const content = block.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      const annotations = p.annotations;
      if (!Array.isArray(annotations)) continue;
      for (const ann of annotations) {
        if (!ann || typeof ann !== "object") continue;
        const a = ann as Record<string, unknown>;
        if (a.type === "url_citation" && typeof a.url === "string") {
          articles.push(
            webArticleFromCitation(
              a.url,
              typeof a.title === "string" ? a.title : a.url,
              ""
            )
          );
        }
      }
    }
  }
  return uniqueArticles(articles);
}

function articlesFromEvidence(evidence: Evidence[]): WebArticle[] {
  return uniqueArticles(
    evidence.map((e) =>
      webArticleFromCitation(e.url, e.title, e.excerpt)
    )
  );
}

function buildUserPrompt(marketTitle: string, marketUrl?: string, todayIso?: string): string {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  return `Date du jour (analyse quotidienne): ${today}

Marche a resoudre: ${marketTitle}
${marketUrl ? `URL Polymarket (contexte): ${marketUrl}` : ""}

Recherche sur le web les faits les plus recents lies a ce marche. Cite uniquement des URLs reelles trouvees.`;
}

async function callResponsesWithWebSearch(
  key: string,
  model: string,
  marketTitle: string,
  marketUrl?: string
): Promise<{ data: Record<string, unknown> } | { error: string }> {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      input: [
        { role: "system", content: ANALYST_SYSTEM },
        { role: "user", content: buildUserPrompt(marketTitle, marketUrl) }
      ]
    }),
    cache: "no-store"
    });
  } catch (error) {
    return { error: `OpenAI Responses (reseau): ${error instanceof Error ? error.message : String(error)}` };
  }

  if (!res.ok) {
    const errText = await res.text();
    return { error: `OpenAI Responses (${res.status}): ${errText.slice(0, 200)}` };
  }

  const data = (await res.json()) as Record<string, unknown>;
  return { data };
}

async function callChatFallback(
  key: string,
  model: string,
  marketTitle: string,
  marketUrl?: string
): Promise<{ data: Record<string, unknown> } | { error: string }> {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANALYST_SYSTEM },
        { role: "user", content: buildUserPrompt(marketTitle, marketUrl) }
      ]
    }),
    cache: "no-store"
    });
  } catch (error) {
    return { error: `OpenAI Chat (reseau): ${error instanceof Error ? error.message : String(error)}` };
  }

  if (!res.ok) {
    const errText = await res.text();
    return { error: `OpenAI Chat (${res.status}): ${errText.slice(0, 200)}` };
  }

  const raw = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = raw.choices?.[0]?.message?.content ?? "";
  return {
    data: {
      output: [{ type: "message", content: [{ type: "output_text", text: content }] }]
    }
  };
}

export async function analyzeMarketWithOpenAI(
  marketTitle: string,
  marketUrl?: string
): Promise<{ result: ExtractionResult | null; articles: WebArticle[]; error?: string }> {
  const key = getOpenAIKey();
  if (!key) {
    return {
      result: null,
      articles: [],
      error: "Cle OpenAI manquante — OPENAI_API_KEY dans .env.local puis redemarrer npm run dev"
    };
  }

  const model = getOpenAIModel();
  let response = await callResponsesWithWebSearch(key, model, marketTitle, marketUrl);

  if ("error" in response) {
    const fallback = await callChatFallback(key, model, marketTitle, marketUrl);
    if ("error" in fallback) {
      return { result: null, articles: [], error: response.error };
    }
    response = fallback;
  }

  const text = extractTextFromResponses(response.data);
  if (!text) {
    return { result: null, articles: [], error: "Reponse OpenAI vide" };
  }

  try {
    const parsed = parseJsonBlock(text);
    const result = normalizeExtraction(parsed);
    if (!result) {
      return { result: null, articles: [], error: "JSON OpenAI invalide" };
    }

    const fromCitations = extractCitationsFromResponses(response.data);
    const fromEvidence = articlesFromEvidence(result.evidence);
    const articles = uniqueArticles([...fromEvidence, ...fromCitations]);

    return { result, articles };
  } catch (e) {
    return {
      result: null,
      articles: [],
      error: e instanceof Error ? e.message : "Erreur parsing OpenAI"
    };
  }
}
