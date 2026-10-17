import type { Category, EventData, Side, Subtype } from "../types";
import { suggestMeal, suggestSleepType } from "./categories";

/** Importing history exported from Nara (or any other tracker) as CSV / Excel. */

export type Cell = string | number | boolean | Date | null;
export interface Table {
  name: string; // file or sheet name, used as a category hint
  headers: string[];
  rows: Cell[][];
  fromExcel: boolean;
}

export const FIELDS = ["type", "details", "start", "date", "time", "end", "duration", "amount", "unit", "side", "left", "right", "note"] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = Partial<Record<Field, number>>;
export type Force = Category | "auto";

export interface ImportedEvent {
  category: Category;
  subtype: Subtype;
  started_at: string;
  ended_at: string;
  data: EventData;
  note: string | null;
}

/* ---------------------------- reading files ---------------------------- */

export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.indexOf("\n") >>> 0);
  const delim = [",", ";", "\t"].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

function toTable(name: string, grid: Cell[][], fromExcel: boolean): Table | null {
  // The header is the first row with at least two non-empty text cells.
  const h = grid.findIndex((r) => r.filter((c) => typeof c === "string" && c.trim()).length >= 2);
  if (h < 0 || grid.length <= h + 1) return null;
  return {
    name,
    headers: grid[h]!.map((c) => String(c ?? "").trim()),
    rows: grid.slice(h + 1).filter((r) => r.some((c) => c !== null && String(c).trim() !== "")),
    fromExcel,
  };
}

export async function readFiles(files: File[]): Promise<Table[]> {
  const out: Table[] = [];
  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, "");
    if (/\.xlsx?$/i.test(f.name)) {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheets = await readXlsxFile(f);
      for (const s of sheets) {
        const tb = toTable(sheets.length > 1 ? `${base} · ${s.sheet}` : base, s.data as unknown as Cell[][], true);
        if (tb) out.push(tb);
      }
    } else {
      const tb = toTable(base, parseCSV(await f.text()), false);
      if (tb) out.push(tb);
    }
  }
  return out;
}

/* ---------------------------- column guessing ---------------------------- */

const HINTS: [Field, RegExp][] = [
  ["left", /left|שמאל/],
  ["right", /right|ימין/],
  ["start", /start|begin|from|התחל/],
  ["end", /\bend|finish|stop|^to$|until|סיום|עד/],
  ["duration", /duration|length|minutes|mins|משך|זמן כולל/],
  ["amount", /amount|quantity|volume|\bml\b|\boz\b|value|reading|כמות|ערך/],
  ["unit", /^unit|units|יחיד/],
  ["side", /side|breast|צד/],
  ["note", /note|comment|memo|הער/],
  ["type", /type|activity|event|category|kind|סוג|פעילות|קטגורי/],
  ["details", /sub|detail|descr|condition|content|status|food|what|name|פירוט|תיאור|מצב/],
  ["date", /date|day|תאריך/],
  ["time", /time|timestamp|שעה/],
];

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  headers.forEach((raw, i) => {
    const h = raw.toLowerCase();
    // "Start date/time" style headers go to start even though they also say "date"/"time".
    for (const [field, re] of HINTS) {
      if (re.test(h) && m[field] === undefined) {
        m[field] = i;
        break;
      }
    }
  });
  // A combined "date & time" or "timestamp" column with no start column is the start.
  if (m.start === undefined && m.date !== undefined && m.time === undefined) {
    m.start = m.date;
    delete m.date;
  }
  if (m.start === undefined && m.time !== undefined && m.date === undefined) {
    m.start = m.time;
    delete m.time;
  }
  return m;
}

/* ---------------------------- value parsing ---------------------------- */

const str = (c: Cell | undefined) => (c === null || c === undefined ? "" : c instanceof Date ? "" : String(c).trim());

/** Excel cells carry no timezone: their UTC fields are the wall-clock values. */
const excelLocal = (raw: Date) => {
  const d = new Date(Math.round(raw.getTime() / 1000) * 1000); // Excel floats land at xx:29:59.999
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
};

function ymd(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ampm?: string) {
  if (y < 100) y += 2000;
  if (ampm) {
    const pm = ampm.toLowerCase().startsWith("p");
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  const out = new Date(y, mo - 1, d, h, mi, s);
  return isNaN(out.getTime()) || mo < 1 || mo > 12 || d < 1 || d > 31 ? null : out;
}

/** Returns which of the two leading numbers in a slash date is the day: true = day first. */
export function detectDayFirst(values: Cell[]): boolean {
  let dayFirst = 0, monthFirst = 0;
  for (const v of values) {
    const m = str(v).match(/^(\d{1,2})[./-](\d{1,2})[./-]\d{2,4}/);
    if (!m) continue;
    if (Number(m[1]) > 12) dayFirst++;
    if (Number(m[2]) > 12) monthFirst++;
  }
  return monthFirst > dayFirst ? false : true;
}

export function parseDateTime(c: Cell | undefined, dayFirst: boolean, fromExcel: boolean): Date | null {
  if (c === null || c === undefined || c === "") return null;
  if (c instanceof Date) return fromExcel ? excelLocal(c) : c;
  if (typeof c === "number") {
    if (c > 20000 && c < 80000) return excelLocal(new Date(Math.round((c - 25569) * 86400000)));
    if (c > 1e11) return new Date(c); // epoch ms
    if (c > 1e9) return new Date(c * 1000); // epoch s
    return null;
  }
  const s = String(c).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?(\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (m) {
    if (m[8]) return new Date(s.replace(" ", "T"));
    return ymd(+m[1]!, +m[2]!, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?)?$/i);
  if (m) {
    const [a, b] = [+m[1]!, +m[2]!];
    return ymd(+m[3]!, dayFirst ? b : a, dayFirst ? a : b, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), m[7]);
  }
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}

/** Time of day in minutes from a "14:05", "2:05 PM" or Excel time cell. */
function parseTimeOfDay(c: Cell | undefined, fromExcel: boolean): number | null {
  if (c instanceof Date) {
    const d = fromExcel ? excelLocal(c) : c;
    return d.getHours() * 60 + d.getMinutes();
  }
  if (typeof c === "number" && c >= 0 && c < 1) return Math.round(c * 1440);
  const m = str(c).match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?/i);
  if (!m) return null;
  let h = +m[1]!;
  if (m[3]) {
    const pm = m[3].toLowerCase().startsWith("p");
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  return h * 60 + +m[2]!;
}

/** Duration in seconds from "1:20:00", "1h 20m", "80 min", "45s", or a plain number of minutes. */
export function parseDuration(c: Cell | undefined): number | null {
  if (c === null || c === undefined || c === "") return null;
  if (c instanceof Date) return c.getUTCHours() * 3600 + c.getUTCMinutes() * 60 + c.getUTCSeconds();
  if (typeof c === "number") return c > 0 && c < 1 ? Math.round(c * 86400) : Math.round(c * 60);
  const s = String(c).trim().toLowerCase();
  let m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (m) return m[3] !== undefined ? +m[1]! * 3600 + +m[2]! * 60 + +m[3] : +m[1]! * 3600 + +m[2]! * 60;
  let total = 0, hit = false;
  for (const [, n, u] of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|ש|שע|m|min|mins|minute|minutes|ד|דק|s|sec|secs|second|seconds)\b/g)) {
    const v = parseFloat(n!.replace(",", "."));
    hit = true;
    if (/^(h|hr|hrs|hour|hours|ש|שע)$/.test(u!)) total += v * 3600;
    else if (/^(s|sec|secs|second|seconds)$/.test(u!)) total += v;
    else total += v * 60;
  }
  if (hit) return Math.round(total);
  m = s.match(/^(\d+(?:[.,]\d+)?)$/);
  return m ? Math.round(parseFloat(m[1]!.replace(",", ".")) * 60) : null;
}

function parseNumber(c: Cell | undefined): number | null {
  if (typeof c === "number") return c;
  const m = str(c).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

const OZ = 29.5735;
function parseMl(c: Cell | undefined, unit: string): number | null {
  const n = parseNumber(c);
  if (n === null) return null;
  return Math.round(/oz/i.test(str(c) + " " + unit) ? n * OZ : n);
}

function parseSide(c: Cell | undefined): Side | "both" | null {
  const s = str(c).toLowerCase();
  if (!s) return null;
  if (/both|שני|2/.test(s)) return "both";
  if (/^l|left|שמאל/.test(s)) return "L";
  if (/^r|right|ימין/.test(s)) return "R";
  return null;
}

/* ---------------------------- classification ---------------------------- */

export function classify(text: string): { category: Category; subtype?: Subtype } | null {
  const s = text.toLowerCase();
  if (/pump|שאיב/.test(s)) return { category: "pumping", subtype: "pumping" };
  if (/sleep|nap|night|שינה|תנומ|לילה/.test(s)) return { category: "sleep", subtype: /nap|תנומ/.test(s) ? "nap" : /night|לילה/.test(s) ? "night" : undefined };
  if (/diaper|nappy|pee|poo|wet|dirty|stool|\bbm\b|חיתול|פיפי|קקי/.test(s)) return { category: "diaper" };
  if (/bottle|formula|בקבוק|תמ"ל|תמ״ל|תמל/.test(s)) return { category: "feeding", subtype: "bottle" };
  if (/breast|nurs|feed.*(left|right)|הנק/.test(s)) return { category: "feeding", subtype: "breastfeeding" };
  if (/solid|food|meal|puree|purée|breakfast|lunch|dinner|snack|מוצק|אוכל|ארוח/.test(s)) return { category: "feeding", subtype: "solids" };
  if (/temp|fever|חום/.test(s)) return { category: "health", subtype: "temperature" };
  if (/weight|height|length|growth|head|משקל|גובה|אורך|גדיל|היקף/.test(s)) return { category: "health", subtype: "growth" };
  if (/medic|\bmed\b|dose|vitamin|drops|תרופ|ויטמין|טיפות/.test(s)) return { category: "health", subtype: "medicine" };
  if (/feed|milk|האכל|חלב/.test(s)) return { category: "feeding", subtype: "bottle" };
  return null;
}

function diaperSubtype(s: string): Subtype {
  s = s.toLowerCase();
  const pee = /pee|wet|urine|פיפי|רטוב/.test(s);
  const poo = /poo|poop|dirty|stool|\bbm\b|קקי|מלוכלך/.test(s);
  if (/mixed|both|מעורב/.test(s) || (pee && poo)) return "mixed";
  if (poo) return "dirty";
  if (/dry|יבש/.test(s)) return "dry";
  return "wet";
}

/* ---------------------------- row → event ---------------------------- */

export interface ConvertOpts {
  dayFirst: boolean;
  force: Force;
}

export function convertRow(table: Table, row: Cell[], m: Mapping, o: ConvertOpts): ImportedEvent | null {
  const get = (f: Field) => (m[f] === undefined ? undefined : row[m[f]!]);
  const typeText = [str(get("type")), str(get("details"))].join(" ");
  let cls = o.force === "auto" ? classify(typeText) ?? classify(table.name) : { category: o.force, ...classify(typeText) };
  if (!cls) return null;
  if (o.force !== "auto" && cls.category !== o.force) cls = { category: o.force };

  // A start cell can be a full date-time, or just a time of day next to a separate date column.
  const isReal = (d: Date | null): d is Date => !!d && !isNaN(d.getTime()) && d.getFullYear() > 1950;
  let start: Date | null = parseDateTime(get("start"), o.dayFirst, table.fromExcel);
  if (!isReal(start)) {
    const date = parseDateTime(get("date"), o.dayFirst, table.fromExcel);
    if (!isReal(date)) return null;
    start = new Date(date);
    const tod = parseTimeOfDay(get("time"), table.fromExcel) ?? parseTimeOfDay(get("start"), table.fromExcel);
    if (tod !== null) start.setHours(Math.floor(tod / 60), tod % 60, 0, 0);
  }

  let end: Date | null = parseDateTime(get("end"), o.dayFirst, table.fromExcel);
  if (!isReal(end)) {
    end = null;
    const endTod = parseTimeOfDay(get("end"), table.fromExcel);
    if (endTod !== null) {
      end = new Date(start);
      end.setHours(Math.floor(endTod / 60), endTod % 60, 0, 0);
    }
  }
  // For pumping, left/right columns are millilitres; for breastfeeding they are durations.
  const isPump = cls.category === "pumping";
  const leftSec = isPump ? null : parseDuration(get("left"));
  const rightSec = isPump ? null : parseDuration(get("right"));
  let dur = parseDuration(get("duration"));
  if (dur === null && (leftSec || rightSec)) dur = (leftSec ?? 0) + (rightSec ?? 0);
  if (!end && dur) end = new Date(start.getTime() + dur * 1000);
  if (end && end < start) end = new Date(end.getTime() + 86400000); // crossed midnight
  if (!end) end = start;

  const unit = str(get("unit"));
  const allText = [typeText, str(get("note")), unit].join(" ");
  const note = str(get("note")) || null;
  const data: EventData = {};
  let subtype: Subtype;

  switch (cls.category) {
    case "sleep":
      subtype = cls.subtype ?? suggestSleepType(start);
      break;
    case "feeding": {
      subtype = cls.subtype ?? "bottle";
      if (subtype === "breastfeeding") {
        const side = parseSide(get("side"));
        let L = leftSec ?? 0, R = rightSec ?? 0;
        if (!L && !R && dur) {
          if (side === "L") L = dur;
          else if (side === "R") R = dur;
          else { L = Math.round(dur / 2); R = dur - L; }
        }
        data.sides = { L, R };
        data.last_side = side === "L" || side === "R" ? side : L >= R ? "L" : "R";
        const ml = parseMl(get("amount"), unit);
        if (ml) data.amount_ml = ml;
      } else if (subtype === "bottle") {
        data.milk_type = /breast ?milk|pumped|expressed|חלב אם/i.test(allText) ? "breastmilk" : "formula";
        data.amount_ml = parseMl(get("amount"), unit) ?? 0;
      } else {
        data.meal = suggestMeal(start);
        data.description = str(get("details")) || note || undefined;
      }
      break;
    }
    case "diaper":
      subtype = diaperSubtype(allText);
      break;
    case "pumping": {
      subtype = "pumping";
      const l = parseMl(get("left"), unit), r = parseMl(get("right"), unit);
      if (l !== null || r !== null) { data.left_ml = l ?? 0; data.right_ml = r ?? 0; }
      else data.left_ml = parseMl(get("amount"), unit) ?? 0;
      break;
    }
    case "health": {
      subtype = cls.subtype ?? "medicine";
      const n = parseNumber(get("amount")) ?? parseNumber(get("details"));
      if (subtype === "temperature" && n !== null) data.celsius = Math.round((n > 50 ? ((n - 32) * 5) / 9 : n) * 10) / 10;
      if (subtype === "growth" && n !== null) {
        if (/head|היקף/i.test(allText)) data.head_cm = n;
        else if (/height|length|גובה|אורך|cm/i.test(allText)) data.length_cm = n;
        else data.weight_kg = n > 100 ? n / 1000 : /lb/i.test(allText) ? Math.round(n * 0.4536 * 100) / 100 : n;
      }
      if (subtype === "medicine") {
        data.name = str(get("details")) || undefined;
        if (n !== null) data.dose = n;
        data.unit = unit || "ml";
      }
      break;
    }
  }
  return {
    category: cls.category,
    subtype,
    started_at: start.toISOString(),
    ended_at: (["sleep", "feeding", "pumping"].includes(cls.category) ? end : start).toISOString(),
    data,
    note,
  };
}

/** Stable id per baby + entry, so importing the same file twice doesn't duplicate anything. */
export async function stableId(babyId: string, e: ImportedEvent): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${babyId}|${e.category}|${e.subtype}|${e.started_at}`));
  const h = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16]!, 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
