import { NextResponse } from "next/server";
import { readMarkets, writeMarkets } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string } | null;
    const id = body?.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "Identifiant marche manquant" }, { status: 400 });
    }

    const markets = await readMarkets();
    const index = markets.findIndex((m) => m.id === id);
    if (index < 0) {
      return NextResponse.json({ error: "Marche introuvable" }, { status: 404 });
    }

    markets[index] = {
      ...markets[index],
      resolution: "pending",
      needsReview: true,
      analysisLabel: "Remis en file d'analyse"
    };
    await writeMarkets(markets);

    return NextResponse.json({ market: markets[index] });
  } catch (error) {
    return NextResponse.json(
      { error: "Echec de la reouverture", details: String(error) },
      { status: 500 }
    );
  }
}
