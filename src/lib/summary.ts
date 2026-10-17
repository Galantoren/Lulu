import type { T } from "../i18n";
import type { BabyEvent, Lang } from "../types";
import { fmtDuration, overlap, startOfDay, DAY, eventEnd } from "./time";
import { sideSeconds } from "./feeding";

/** One-line description of an event, e.g. "Bottle · Formula 120 ml". */
export function eventTitle(e: BabyEvent, t: T, lang: Lang, now = Date.now()): string {
  const d = e.data;
  switch (e.subtype) {
    case "nap":
    case "night":
      return [t(e.subtype), d.location && t(d.location as never)].filter(Boolean).join(" · ");
    case "breastfeeding": {
      const s = sideSeconds(e, now);
      const parts = [t("breastfeeding")];
      if (s.L >= 30) parts.push(`${t("L")} ${fmtDuration(s.L * 1000, lang)}`);
      if (s.R >= 30) parts.push(`${t("R")} ${fmtDuration(s.R * 1000, lang)}`);
      if (d.amount_ml) parts.push(`${d.amount_ml} ml`);
      return parts.join(" · ");
    }
    case "bottle":
      return `${t("bottle")} · ${t(d.milk_type ?? "formula")}${d.amount_ml ? ` ${d.amount_ml} ml` : ""}`;
    case "solids":
      return [t(d.meal ?? "snack"), d.description].filter(Boolean).join(" · ");
    case "wet":
    case "dirty":
    case "mixed":
    case "dry":
      return `${t("diaper")} · ${t(e.subtype)}`;
    case "pumping": {
      const ml = (d.left_ml ?? 0) + (d.right_ml ?? 0);
      return `${t("pumping")}${ml ? ` · ${ml} ml` : ""}`;
    }
    case "medicine":
      return [d.name || t("medicine"), d.dose != null && `${d.dose} ${d.unit ?? ""}`.trim()].filter(Boolean).join(" · ");
    case "temperature":
      return `${t("temperature")}${d.celsius ? ` · ${d.celsius.toFixed(1)} °C` : ""}`;
    case "growth":
      return [
        t("growth"),
        d.weight_kg && `${d.weight_kg} kg`,
        d.length_cm && `${d.length_cm} cm`,
        d.head_cm && `⌀ ${d.head_cm} cm`,
      ].filter(Boolean).join(" · ");
  }
  return t(e.category);
}

export const hasDuration = (e: BabyEvent) => ["sleep", "feeding", "pumping"].includes(e.category);

export interface DayStats {
  sleepMs: number;
  naps: number;
  nightMs: number;
  feeds: number;
  bottleMl: number;
  breastMin: number;
  meals: number;
  wet: number;
  dirty: number;
  diapers: number;
  pumpedMl: number;
}

export function dayStats(events: BabyEvent[], day: Date, now: number): DayStats {
  const from = startOfDay(day).getTime();
  const to = from + DAY;
  const s: DayStats = { sleepMs: 0, naps: 0, nightMs: 0, feeds: 0, bottleMl: 0, breastMin: 0, meals: 0, wet: 0, dirty: 0, diapers: 0, pumpedMl: 0 };
  for (const e of events) {
    const st = new Date(e.started_at).getTime();
    const inDay = st >= from && st < to;
    if (e.category === "sleep") {
      const ms = overlap(e, from, to, now);
      s.sleepMs += ms;
      if (e.subtype === "night") s.nightMs += ms;
      if (inDay && e.subtype === "nap") s.naps++;
    }
    if (!inDay) continue;
    if (e.category === "feeding") {
      s.feeds++;
      if (e.subtype === "bottle") s.bottleMl += e.data.amount_ml ?? 0;
      if (e.subtype === "breastfeeding") {
        const sides = sideSeconds(e, now);
        s.breastMin += Math.round((sides.L + sides.R) / 60);
      }
      if (e.subtype === "solids") s.meals++;
    }
    if (e.category === "diaper" && e.subtype !== "dry") {
      s.diapers++;
      if (e.subtype === "wet" || e.subtype === "mixed") s.wet++;
      if (e.subtype === "dirty" || e.subtype === "mixed") s.dirty++;
    }
    if (e.category === "pumping") s.pumpedMl += (e.data.left_ml ?? 0) + (e.data.right_ml ?? 0);
  }
  return s;
}

/** Longest single night-sleep stretch that ended in the last 24h. */
export function longestNight(events: BabyEvent[], now: number): number {
  let best = 0;
  for (const e of events) {
    if (e.category !== "sleep" || e.subtype !== "night") continue;
    const end = eventEnd(e, now);
    if (now - end > DAY) continue;
    best = Math.max(best, end - new Date(e.started_at).getTime());
  }
  return best;
}
