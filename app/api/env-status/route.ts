import { NextResponse } from "next/server";
import { getOpenAIKey, getOpenAIModel } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    openai: Boolean(getOpenAIKey()),
    model: getOpenAIModel(),
    webSearch: true
  });
}
