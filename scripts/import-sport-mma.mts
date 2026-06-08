import { readFileSync } from "fs";
import { parseCsvToMarkets } from "../lib/importer.ts";
import { readMarkets, writeMarkets } from "../lib/storage.ts";

const csvPath =
  process.argv[2] ??
  "/Users/martinchevalier/Downloads/Supabase Snippet List Markets by Category and Title.csv";

const csv = readFileSync(csvPath, "utf8");
const existing = await readMarkets();
const { markets, summary } = parseCsvToMarkets(csv, existing);
await writeMarkets(markets);

console.log(JSON.stringify(summary, null, 2));
console.log(`Total marches: ${markets.length}`);
