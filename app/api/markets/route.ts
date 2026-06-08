import { NextResponse } from "next/server";
import { isMarketResolved } from "@/lib/resolved";
import { CATEGORIES, Category } from "@/lib/types";
import { readMarkets } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get("category");
    const resolvedParam = searchParams.get("resolved");

    const markets = await readMarkets();
    let filtered = markets;

    if (categoryParam && CATEGORIES.includes(categoryParam as Category)) {
      filtered = filtered.filter((m) => m.category === categoryParam);
    }

    if (resolvedParam === "true") {
      filtered = filtered.filter(isMarketResolved);
    } else if (resolvedParam === "false") {
      filtered = filtered.filter((m) => !isMarketResolved(m));
    }

    return NextResponse.json({ markets: filtered });
  } catch (error) {
    return NextResponse.json(
      { error: "Impossible de charger les marches", details: String(error) },
      { status: 500 }
    );
  }
}
