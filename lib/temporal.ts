import { formatDateFr, isJuneOnlyMarketTitle } from "./dates";
import { Resolution, MarketStatus } from "./types";

const monthMap: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  "février": 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  "août": 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
  "décembre": 11
};

export const JUNE_2026_START = new Date(Date.UTC(2026, 5, 1, 0, 0, 0));
export const JUNE_2026_END = new Date(Date.UTC(2026, 5, 30, 23, 59, 59));

export function parseDeadlineFromTitle(title: string): Date | null {
  const lower = title.toLowerCase();

  const dayMonthYear = lower.match(/(?:le|avant le)\s+(\d{1,2})\s+([a-zéûôî]+)\s+(2026)/i);
  if (dayMonthYear) {
    const day = Number(dayMonthYear[1]);
    const monthIdx = monthMap[dayMonthYear[2]] ?? -1;
    if (monthIdx >= 0) return new Date(Date.UTC(2026, monthIdx, day, 23, 59, 59));
  }

  const dayMonthNoYear = lower.match(/(?:le|avant le)\s+(\d{1,2})\s+juin\b/i);
  if (dayMonthNoYear) {
    const day = Number(dayMonthNoYear[1]);
    return new Date(Date.UTC(2026, 5, day, 23, 59, 59));
  }

  if (
    /\ben juin(?:\s+2026)?\b/i.test(lower) ||
    /\bsur le mois de juin\b/i.test(lower) ||
    /\bpendant le mois de juin\b/i.test(lower) ||
    /\bau cours de juin\b/i.test(lower)
  ) {
    return JUNE_2026_END;
  }

  return null;
}

export function getMarketDeadline(title: string): Date {
  return parseDeadlineFromTitle(title) ?? JUNE_2026_END;
}

export function isMarketPeriodActive(title: string, now: Date = new Date()): boolean {
  return now >= JUNE_2026_START && now <= getMarketDeadline(title);
}

function formatDeadlineLabel(deadline: Date): string {
  return formatDateFr(deadline);
}

function hasSpecificDateLabel(label: string): boolean {
  return /\b(hors juin|avant le 1er juin|contradictoire|non confirme|Sources contradictoires)\b/i.test(
    label
  );
}

export function applyJune2026Rules(params: {
  title: string;
  status: MarketStatus;
  resolution: Resolution;
  label?: string;
  now?: Date;
}): { status: MarketStatus; resolution: Resolution; label: string } {
  const now = params.now ?? new Date();
  const deadline = getMarketDeadline(params.title);
  const inputLabel = params.label?.trim() ?? "";

  if (now < JUNE_2026_START) {
    return {
      status: "open",
      resolution: "pending",
      label: "En attente — le marché n'a pas encore commencé (juin 2026)"
    };
  }

  // Avant ou le jour de l'échéance : toujours OUVERT, analyse quotidienne
  if (now <= deadline) {
    let resolution = params.resolution;
    let label = inputLabel;

    if (resolution === "no" || resolution === "uncertain") {
      const base = hasSpecificDateLabel(label)
        ? label
        : label || "Rien de confirmé à ce jour pour la période du marché";
      resolution = "pending";
      if (!hasSpecificDateLabel(label)) {
        label = `${base} — marché ouvert jusqu'au ${formatDeadlineLabel(deadline)} (suivi quotidien)`;
      }
    } else if (resolution === "yes") {
      label =
        label ||
        (isJuneOnlyMarketTitle(params.title)
          ? "Oui confirmé en juin — marché encore ouvert jusqu'à l'échéance"
          : "Oui confirmé — marché encore ouvert jusqu'à l'échéance");
    } else if (resolution === "pending" && !label) {
      label = `En attente — échéance le ${formatDeadlineLabel(deadline)}`;
    }

    return {
      status: "open",
      resolution,
      label
    };
  }

  // Après l'échéance : FERMÉ + résolution définitive
  let resolution = params.resolution;
  let label = inputLabel;

  if (resolution === "pending" || resolution === "uncertain") {
    resolution = "no";
    label = label || `Non — échéance du ${formatDeadlineLabel(deadline)} dépassée sans confirmation`;
  }

  return {
    status: "closed",
    resolution,
    label:
      resolution === "yes"
        ? label || "Résolu : Oui"
        : resolution === "no"
          ? label || "Résolu : Non"
          : label || "Marché clôturé"
  };
}
