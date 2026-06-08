import { createHash } from "crypto";
import { CATEGORIES, Category, ImportSummary, Market } from "./types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function normalizeCategory(value: string): Category {
  const v = slugify(value);
  const aliases: Record<string, Category> = {
    ai: "ia",
    ia: "ia",
    world: "monde",
    monde: "monde",
    politique: "politique",
    politics: "politique",
    business: "business",
    crypto: "crypto",
    sports: "sport",
    sport: "sport",
    mma: "mma",
    unknownmmapro: "mma"
  };
  if (aliases[v]) return aliases[v];
  if ((CATEGORIES as readonly string[]).includes(v)) {
    return v as Category;
  }
  return "monde";
}

function isKnownCategorySlug(slug: string): boolean {
  return normalizeCategory(slug) !== "monde" || slug === "monde" || slug === "world";
}

function idFromValue(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

export function parseCsvToMarkets(csv: string, existing: Market[]): { markets: Market[]; summary: ImportSummary } {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const total = lines.length;
  let imported = 0;
  let skipped = 0;

  const dedupeSet = new Set<string>(
    existing.map((m) => (m.url ? `url:${m.url}` : `title:${m.category}:${slugify(m.title)}`))
  );

  const additions: Market[] = [];

  for (const line of lines) {
    const fields = parseCsvLine(line);
    if (fields.length < 2) {
      skipped += 1;
      continue;
    }

    const first = fields[0].replace(/^"|"$/g, "");
    const second = fields[1].replace(/^"|"$/g, "");
    const headerLike =
      slugify(first) === "title" ||
      slugify(first) === "titre" ||
      slugify(first) === "category" ||
      slugify(first) === "categorie";

    if (headerLike) {
      skipped += 1;
      continue;
    }

    const firstLooksCategory = isKnownCategorySlug(slugify(first));
    const secondLooksCategory = isKnownCategorySlug(slugify(second));
    const secondIsUrl = /^https?:\/\//i.test(second);

    let title = first;
    let category: Category = "monde";
    let url: string | undefined;

    if (firstLooksCategory && !secondIsUrl) {
      category = normalizeCategory(first);
      title = second;
    } else if (secondLooksCategory) {
      category = normalizeCategory(second);
      title = first;
    } else if (secondIsUrl) {
      category = "monde";
      title = first;
      url = second;
    } else {
      category = normalizeCategory(second);
      title = first;
    }

    if (!title) {
      skipped += 1;
      continue;
    }

    const dedupeKey = url ? `url:${url}` : `title:${category}:${slugify(title)}`;

    if (dedupeSet.has(dedupeKey)) {
      skipped += 1;
      continue;
    }

    dedupeSet.add(dedupeKey);
    additions.push({
      id: idFromValue(dedupeKey),
      title,
      category,
      url,
      status: "pending",
      resolution: "pending",
      analysisLabel: "En attente d'analyse",
      sources: url ? [url] : []
    });
    byCategory[category] += 1;
    imported += 1;
  }

  return {
    markets: [...existing, ...additions],
    summary: { imported, skipped, total, byCategory }
  };
}
