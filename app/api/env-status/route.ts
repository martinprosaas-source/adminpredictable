import { NextResponse } from "next/server";
import { getOpenAIKey, getOpenAIModel } from "@/lib/env";
import { BLOB_SETUP_HINT, getStorageMode, hasBlobStorage, isVercelRuntime } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const blobConfigured = hasBlobStorage();
  const onVercel = isVercelRuntime();
  const storageReady = !onVercel || blobConfigured;

  return NextResponse.json({
    openai: Boolean(getOpenAIKey()),
    model: getOpenAIModel(),
    webSearch: true,
    storage: getStorageMode(),
    blobConfigured,
    vercel: onVercel,
    storageReady,
    storageHint: storageReady ? undefined : BLOB_SETUP_HINT
  });
}
