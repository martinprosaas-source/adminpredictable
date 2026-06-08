import { NextResponse } from "next/server";
import { analyzeMarket } from "@/lib/analyzer";
import { isMarketResolved } from "@/lib/resolved";
import { Category, CATEGORIES } from "@/lib/types";
import { readMarkets, writeMarkets } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { category?: Category } | null;
    const selectedCategory = body?.category;
    if (!selectedCategory || !CATEGORIES.includes(selectedCategory)) {
      return NextResponse.json({ error: "Categorie manquante ou invalide" }, { status: 400 });
    }

    const markets = await readMarkets();
    let updated = 0;
    let skipped = 0;

    const nextMarkets = [...markets];
    for (let i = 0; i < nextMarkets.length; i++) {
      if (nextMarkets[i].category !== selectedCategory) continue;
      if (isMarketResolved(nextMarkets[i])) {
        skipped += 1;
        continue;
      }
      updated += 1;
      nextMarkets[i] = await analyzeMarket(nextMarkets[i]);
    }
    await writeMarkets(nextMarkets);

    return NextResponse.json({
      updated,
      skipped,
      scope: selectedCategory
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Echec de l'analyse", details: String(error) },
      { status: 500 }
    );
  }
}
