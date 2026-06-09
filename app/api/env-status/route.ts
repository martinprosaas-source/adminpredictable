import { NextResponse } from "next/server";
import { getOpenAIKey, getOpenAIModel } from "@/lib/env";
import { getStorageMode } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    openai: Boolean(getOpenAIKey()),
    model: getOpenAIModel(),
    webSearch: true,
    storage: getStorageMode(),
    blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim())
  });
}
