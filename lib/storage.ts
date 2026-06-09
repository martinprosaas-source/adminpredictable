import { promises as fs } from "fs";
import path from "path";
import { BlobNotFoundError, get, put } from "@vercel/blob";
import { Market } from "./types";

const dataFile = path.join(process.cwd(), "data", "markets.json");
const BLOB_PATHNAME = "markets.json";

export type StorageMode = "blob" | "file";

export function getStorageMode(): StorageMode {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "blob" : "file";
}

function parseMarkets(raw: string): Market[] {
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw) as Market[];
  return Array.isArray(parsed) ? parsed : [];
}

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, "[]", "utf8");
  }
}

async function readLocalFile(): Promise<Market[]> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, "utf8");
  return parseMarkets(raw);
}

async function readFromBlob(): Promise<Market[] | null> {
  try {
    const result = await get(BLOB_PATHNAME, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const raw = await new Response(result.stream).text();
    return parseMarkets(raw);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

async function writeToBlob(markets: Market[]): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(markets, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
}

export async function readMarkets(): Promise<Market[]> {
  if (getStorageMode() === "blob") {
    const fromBlob = await readFromBlob();
    if (fromBlob) return fromBlob;

    const local = await readLocalFile();
    if (local.length > 0) {
      await writeToBlob(local);
    }
    return local;
  }

  return readLocalFile();
}

export async function writeMarkets(markets: Market[]): Promise<void> {
  if (getStorageMode() === "blob") {
    await writeToBlob(markets);
    return;
  }

  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify(markets, null, 2), "utf8");
}
