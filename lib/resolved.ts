import type { Market } from "./types";

/** Marche tranche avec verdict fiable — plus re-analyse automatique. */
export function isMarketResolved(market: Pick<Market, "resolution" | "needsReview">): boolean {
  const decisive = market.resolution === "yes" || market.resolution === "no";
  return decisive && market.needsReview === false;
}

export function isMarketActive(market: Pick<Market, "resolution" | "needsReview">): boolean {
  return !isMarketResolved(market);
}
