export const JUNE_2026_START = new Date(Date.UTC(2026, 5, 1, 0, 0, 0));
export const JUNE_2026_END = new Date(Date.UTC(2026, 5, 30, 23, 59, 59));

const monthMap: Record<string, number> = {
  jan: 0,
  january: 0,
  janvier: 0,
  feb: 1,
  february: 1,
  fevrier: 1,
  février: 1,
  mar: 2,
  march: 2,
  mars: 2,
  apr: 3,
  april: 3,
  avril: 3,
  may: 4,
  mai: 4,
  jun: 5,
  june: 5,
  juin: 5,
  jul: 6,
  july: 6,
  juillet: 6,
  aug: 7,
  august: 7,
  aout: 7,
  août: 7,
  sep: 8,
  sept: 8,
  september: 8,
  septembre: 8,
  oct: 9,
  october: 9,
  octobre: 9,
  nov: 10,
  november: 10,
  novembre: 10,
  dec: 11,
  december: 11,
  decembre: 11,
  décembre: 11
};

export function isJuneOnlyMarketTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    /\ben juin(?:\s+2026)?\b/.test(lower) ||
    /\bpendant le mois de juin\b/.test(lower) ||
    /\bsur le mois de juin\b/.test(lower) ||
    /\bdurant le mois de juin\b/.test(lower) ||
    /\bau cours de juin\b/.test(lower) ||
    /\bpour le mois de juin\b/.test(lower)
  );
}

export function parseDateFromUrl(url: string): Date | null {
  const slash = url.match(/\/(2026)\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\//);
  if (slash) {
    return new Date(Date.UTC(Number(slash[1]), Number(slash[2]) - 1, Number(slash[3]), 12, 0, 0));
  }
  const iso = url.match(/(2026)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0));
  }
  return null;
}

export function parseDateFromIsoString(value: string): Date | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateFromText(text: string): Date | null {
  const lower = text.toLowerCase();

  const iso = lower.match(/\b(2026)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (iso) return parseDateFromIsoString(`${iso[1]}-${iso[2]}-${iso[3]}`);

  const slash = lower.match(/\b(2026)[/.-](0[1-9]|1[0-2])[/.-](0[1-9]|[12]\d|3[01])\b/);
  if (slash) return parseDateFromIsoString(`${slash[1]}-${slash[2]}-${slash[3]}`);

  const dayMonthYear = lower.match(/\b(\d{1,2})\s+([a-zéûôî]+)\s+(2026)\b/);
  if (dayMonthYear) {
    const monthIdx = monthMap[dayMonthYear[2]];
    if (monthIdx !== undefined) {
      return new Date(Date.UTC(2026, monthIdx, Number(dayMonthYear[1]), 12, 0, 0));
    }
  }

  const monthDayYear = lower.match(/\b([a-z]+)\s+(\d{1,2}),?\s+(2026)\b/);
  if (monthDayYear) {
    const monthIdx = monthMap[monthDayYear[1]];
    if (monthIdx !== undefined) {
      return new Date(Date.UTC(2026, monthIdx, Number(monthDayYear[2]), 12, 0, 0));
    }
  }

  return null;
}

export function isWithinJune2026(date: Date): boolean {
  return date >= JUNE_2026_START && date <= JUNE_2026_END;
}

export function isBeforeJune2026(date: Date): boolean {
  return date < JUNE_2026_START;
}

export function formatDateFr(date: Date): string {
  return date.toISOString().slice(0, 10);
}
