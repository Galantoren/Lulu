import type { BabyEvent, Lang } from "../types";

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export function startOfDay(d: Date | number = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Durations keep Latin units in both languages so they stay readable inside LTR number runs.
const U = {
  en: { h: "h", m: "m", s: "s" },
  he: { h: "h", m: "m", s: "s" },
};

/** "1h 42m", "6m", "45s" — compact and stable. */
export function fmtDuration(ms: number, lang: Lang = "en", withSeconds = false): string {
  const u = U[lang];
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}${u.h} ${m}${u.m}`;
  if (m > 0) return withSeconds ? `${m}${u.m} ${String(s).padStart(2, "0")}${u.s}` : `${m}${u.m}`;
  return withSeconds ? `${s}${u.s}` : `0${u.m}`;
}

export function fmtClock(iso: string | Date, format: "24h" | "12h" = "24h"): string {
  const d = new Date(iso);
  if (format === "12h") {
    const h = d.getHours() % 12 || 12;
    return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "am" : "pm"}`;
  }
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDate(d: Date, lang: Lang): string {
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

export function eventEnd(e: BabyEvent, now: number): number {
  return e.ended_at ? new Date(e.ended_at).getTime() : now;
}

/** Milliseconds of [start,end) that fall inside [from,to). */
export function overlap(e: BabyEvent, from: number, to: number, now: number): number {
  const s = Math.max(new Date(e.started_at).getTime(), from);
  const en = Math.min(eventEnd(e, now), to);
  return Math.max(0, en - s);
}

export function ageParts(birth: string | null, now = new Date()) {
  if (!birth) return null;
  const b = new Date(birth + "T00:00:00");
  const days = Math.floor((startOfDay(now).getTime() - b.getTime()) / DAY);
  if (days < 0) return null;
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months--;
  const anchor = new Date(b);
  anchor.setMonth(anchor.getMonth() + months);
  const weeks = Math.floor((startOfDay(now).getTime() - anchor.getTime()) / (7 * DAY));
  return { days, months, weeks };
}
