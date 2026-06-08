import { promises as fs } from "fs";
import path from "path";
import { Market } from "./types";

const dataFile = path.join(process.cwd(), "data", "markets.json");

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, "[]", "utf8");
  }
}

export async function readMarkets(): Promise<Market[]> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, "utf8");
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw) as Market[];
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeMarkets(markets: Market[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify(markets, null, 2), "utf8");
}
