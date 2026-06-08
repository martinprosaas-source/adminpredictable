"use client";

import { useEffect, useMemo, useState } from "react";
import { buildExplanationFr, onTopicLabelFr, supportsLabelFr } from "@/lib/explanation";
import { CATEGORIES, Category, Confidence, Market, MarketStatus, Resolution } from "@/lib/types";

type AnalyzeSummary = {
  updated: number;
  skipped?: number;
  scope?: string;
};

type ListMode = "active" | "resolved";

const statusClass: Record<MarketStatus, string> = {
  open: "bg-emerald-600/20 text-emerald-300 border-emerald-500/40",
  closed: "bg-rose-600/20 text-rose-300 border-rose-500/40",
  pending: "bg-amber-600/20 text-amber-300 border-amber-500/40",
  unknown: "bg-slate-600/20 text-slate-300 border-slate-500/40"
};

const statusLabel: Record<MarketStatus, string> = {
  open: "Ouvert",
  closed: "Ferme",
  pending: "En attente",
  unknown: "Inconnu"
};

const resolutionLabel: Record<Resolution, string> = {
  yes: "Oui",
  no: "Non",
  pending: "En attente",
  uncertain: "?"
};

const confidenceLabel: Record<Confidence, string> = {
  high: "Elevee",
  medium: "Moyenne",
  low: "Faible"
};

function confidenceBadgeClass(confidence?: Confidence): string {
  if (confidence === "high") return "bg-emerald-700/30 text-emerald-200 border-emerald-500/40";
  if (confidence === "medium") return "bg-amber-700/30 text-amber-200 border-amber-500/40";
  if (confidence === "low") return "bg-rose-700/30 text-rose-200 border-rose-500/40";
  return "bg-slate-700/30 text-slate-400 border-slate-500/40";
}

function hasWhyDetail(market: Market): boolean {
  return Boolean(
    market.explanationFr?.trim() ||
      market.analysisLabel?.trim() ||
      (market.evidence?.length ?? 0) > 0
  );
}

function resolveBadgeClass(resolution: Resolution): string {
  if (resolution === "yes") return "bg-emerald-700/30 text-emerald-200 border-emerald-500/40";
  if (resolution === "no") return "bg-rose-700/30 text-rose-200 border-rose-500/40";
  if (resolution === "pending") return "bg-amber-700/30 text-amber-200 border-amber-500/40";
  return "bg-slate-700/30 text-slate-300 border-slate-500/40";
}

export default function Page() {
  const [category, setCategory] = useState<Category>("politique");
  const [listMode, setListMode] = useState<ListMode>("active");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzeSummary, setAnalyzeSummary] = useState<AnalyzeSummary | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadMarkets(currentCategory: Category, mode: ListMode): Promise<void> {
    try {
      const resolved = mode === "resolved" ? "true" : "false";
      const res = await fetch(`/api/markets?category=${currentCategory}&resolved=${resolved}`);
      const json = (await res.json()) as { markets?: Market[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erreur de chargement");
      setMarkets(json.markets ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  useEffect(() => {
    setError(null);
    setExpandedId(null);
    void loadMarkets(category, listMode);
  }, [category, listMode]);

  async function onAnalyze(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      setAnalyzeSummary(null);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category })
      });
      const json = (await res.json()) as AnalyzeSummary & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Analyse impossible");
      setAnalyzeSummary({
        updated: json.updated,
        skipped: json.skipped,
        scope: json.scope
      });
      await loadMarkets(category, "active");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur pendant l'analyse");
    } finally {
      setLoading(false);
    }
  }

  const analyzeMessage = useMemo(() => {
    if (!analyzeSummary) return null;
    const skipped = analyzeSummary.skipped ?? 0;
    const skippedText = skipped > 0 ? `, ${skipped} deja resolus ignores` : "";
    return `${analyzeSummary.updated} marches analyses (${category})${skippedText}`;
  }, [analyzeSummary, category]);

  async function onReopen(marketId: string): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: marketId })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Reouverture impossible");
      setListMode("active");
      await loadMarkets(category, "active");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur pendant la reouverture");
    } finally {
      setLoading(false);
    }
  }

  async function onClearCategory(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Vidage impossible");
      await loadMarkets(category, listMode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur pendant le vidage");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Admin Predictable</h1>
        <div className="text-sm text-slate-400">Back-office des marches de prediction</div>
      </div>

      <section className="card mb-6 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-slate-300">Categories</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setListMode("active")}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                listMode === "active"
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              A traiter
            </button>
            <button
              type="button"
              onClick={() => setListMode("resolved")}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                listMode === "resolved"
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              Resolus
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                category === cat
                  ? listMode === "resolved"
                    ? "bg-violet-600/80 text-white ring-1 ring-violet-400"
                    : "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {listMode === "resolved" ? (
          <p className="mt-3 text-xs text-slate-400">
            Marches deja tranches (Oui/Non + verdict fiable). Consultation seule — pas de re-analyse automatique.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-400">
            Marches encore a analyser ou a valider dans cette categorie.
          </p>
        )}
      </section>

      {listMode === "active" ? (
      <section className="card mb-6 p-4">
        <label className="mb-2 block text-sm font-medium">Actions sur la categorie</label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onAnalyze}
            disabled={loading}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            Analyser la categorie
          </button>
          <button
            onClick={onClearCategory}
            disabled={loading}
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium hover:bg-rose-500 disabled:opacity-50"
          >
            Vider la categorie
          </button>
        </div>
        {analyzeMessage ? <p className="mt-3 text-sm text-slate-300">{analyzeMessage}</p> : null}
      </section>
      ) : null}

      {error ? (
        <p className="mb-4 text-sm text-rose-300">Erreur: {error}</p>
      ) : null}

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-800/70 text-left text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Resolution</th>
                <th className="px-4 py-3 font-medium">Confiance</th>
                <th className="px-4 py-3 font-medium">Derniere analyse</th>
                <th className="px-4 py-3 font-medium">Sources / preuves</th>
              </tr>
            </thead>
            <tbody>
              {markets.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={6}>
                    {listMode === "resolved"
                      ? "Aucun marche resolu dans cette categorie."
                      : "Aucun marche a traiter dans cette categorie."}
                  </td>
                </tr>
              ) : (
                markets.map((market) => (
                  <tr key={market.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">
                      <div className="font-medium">{market.title}</div>
                      {market.needsReview === false ? (
                        <span className="mt-1 inline-block rounded border border-emerald-500/40 bg-emerald-900/30 px-1.5 py-0.5 text-[10px] text-emerald-200">
                          Verdict fiable
                        </span>
                      ) : market.needsReview ? (
                        <span className="mt-1 inline-block rounded border border-amber-500/40 bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-200">
                          A valider
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${statusClass[market.status]}`}>
                        {statusLabel[market.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${resolveBadgeClass(market.resolution)}`}>
                        {resolutionLabel[market.resolution]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs ${confidenceBadgeClass(market.confidence)}`}
                      >
                        {market.confidence ? confidenceLabel[market.confidence] : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div>{market.analysisLabel || "-"}</div>
                      <div className="text-xs text-slate-500">
                        {market.lastAnalysisAt ? new Date(market.lastAnalysisAt).toLocaleString("fr-FR") : "Jamais"}
                      </div>
                      {listMode === "resolved" ? (
                        <button
                          type="button"
                          onClick={() => void onReopen(market.id)}
                          disabled={loading}
                          className="mt-1 text-xs text-amber-300 hover:text-amber-200 disabled:opacity-50"
                        >
                          Rouvrir (re-analyser)
                        </button>
                      ) : null}
                      {hasWhyDetail(market) ? (
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === market.id ? null : market.id)}
                          className="mt-1 text-xs text-indigo-300 hover:text-indigo-200"
                        >
                          {expandedId === market.id ? "Masquer le détail" : "Voir le pourquoi"}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {market.sources.length === 0 ? (
                          <span className="text-slate-500">-</span>
                        ) : (
                          market.sources.map((source) => (
                            <a
                              key={source}
                              href={source}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-300 hover:text-indigo-200 hover:underline"
                            >
                              {source}
                            </a>
                          ))
                        )}
                        {expandedId === market.id && hasWhyDetail(market) ? (
                          <div className="mt-2 space-y-3 border-t border-slate-700 pt-2 text-xs">
                            <div>
                              <p className="mb-1 font-medium text-slate-300">Pourquoi cette résolution ?</p>
                              <p className="whitespace-pre-wrap leading-relaxed text-slate-400">
                                {buildExplanationFr(market)}
                              </p>
                            </div>
                            {(market.evidence?.length ?? 0) > 0 ? (
                              <div>
                                <p className="mb-1 font-medium text-slate-300">Preuves par source</p>
                                <ul className="space-y-2 text-slate-400">
                                  {market.evidence!.map((item) => (
                                    <li key={`${item.url}-${item.excerpt.slice(0, 40)}`}>
                                      <span
                                        className={`mr-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                                          item.supports === "yes"
                                            ? "bg-emerald-900/50 text-emerald-200"
                                            : item.supports === "no"
                                              ? "bg-rose-900/50 text-rose-200"
                                              : "bg-slate-800 text-slate-400"
                                        }`}
                                      >
                                        {supportsLabelFr(item.supports)}
                                      </span>
                                      <span
                                        className={`mr-1 inline-block rounded px-1.5 py-0.5 text-[10px] ${
                                          item.onTopic === true
                                            ? "bg-indigo-900/50 text-indigo-200"
                                            : item.onTopic === false
                                              ? "bg-slate-800 text-slate-400"
                                              : "bg-slate-900 text-slate-500"
                                        }`}
                                      >
                                        {onTopicLabelFr(item.onTopic)}
                                      </span>
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-indigo-300 hover:underline"
                                      >
                                        {item.title}
                                      </a>
                                      {item.publishedAt ? (
                                        <span className="ml-1 text-slate-500">
                                          —{" "}
                                          {new Date(item.publishedAt).toLocaleDateString("fr-FR", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric"
                                          })}
                                        </span>
                                      ) : null}
                                      <p className="mt-1 text-slate-500">{item.excerpt}</p>
                                      {item.relevance ? (
                                        <p className="mt-0.5 italic text-slate-500">{item.relevance}</p>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
