import { NextResponse } from "next/server";
import { analyzeMarket } from "@/lib/analyzer";
import { isMarketResolved } from "@/lib/resolved";
import { Category, CATEGORIES } from "@/lib/types";
import { readMarkets, writeMarkets } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { category?: Category; marketId?: string } | null;
    const selectedCategory = body?.category;
    const marketId = body?.marketId?.trim();

    if (!selectedCategory || !CATEGORIES.includes(selectedCategory)) {
      return NextResponse.json({ error: "Categorie manquante ou invalide" }, { status: 400 });
    }
    if (!marketId) {
      return NextResponse.json(
        { error: "marketId requis — analyse un marche a la fois" },
        { status: 400 }
      );
    }

    const markets = await readMarkets();
    const index = markets.findIndex((m) => m.id === marketId && m.category === selectedCategory);
    if (index < 0) {
      return NextResponse.json({ error: "Marche introuvable dans cette categorie" }, { status: 404 });
    }

    if (isMarketResolved(markets[index])) {
      return NextResponse.json({
        market: markets[index],
        skipped: true,
        scope: selectedCategory
      });
    }

    markets[index] = await analyzeMarket(markets[index]);
    await writeMarkets(markets);

    return NextResponse.json({
      market: markets[index],
      updated: true,
      scope: selectedCategory
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Echec de l'analyse", details: String(error) },
      { status: 500 }
    );
  }
}
