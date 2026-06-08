import { NextResponse } from "next/server";
import { parseCsvToMarkets } from "@/lib/importer";
import { readMarkets, writeMarkets } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { csv?: string };
    if (!body.csv?.trim()) {
      return NextResponse.json({ error: "CSV vide ou manquant" }, { status: 400 });
    }

    const existing = await readMarkets();
    const { markets, summary } = parseCsvToMarkets(body.csv, existing);
    await writeMarkets(markets);
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: "Echec de l'import CSV", details: String(error) },
      { status: 500 }
    );
  }
}
