import { NextResponse } from "next/server";
import { Category } from "@/lib/types";
import { readMarkets, writeMarkets } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { category?: Category };
    if (!body.category) {
      return NextResponse.json({ error: "Categorie manquante" }, { status: 400 });
    }

    const markets = await readMarkets();
    const kept = markets.filter((m) => m.category !== body.category);
    await writeMarkets(kept);
    return NextResponse.json({ deleted: markets.length - kept.length });
  } catch (error) {
    return NextResponse.json(
      { error: "Echec du vidage de categorie", details: String(error) },
      { status: 500 }
    );
  }
}
