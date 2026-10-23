import { Moon, SlidersHorizontal, Sun, Sunrise } from "lucide-react";
import { useApp } from "../state/AppContext";
import { CATEGORY_ICON, catVar } from "../lib/categories";
import { DAY, HOUR, fmtClock, fmtDuration, startOfDay } from "../lib/time";
import type { BabyEvent, Category } from "../types";

// Chart geometry (SVG user units; the SVG scales to the card width).
const W = 340;
const START = 24; // room for the lane icons at the start side
const END = 10;
// Asleep is the top level and awake the bottom: sleep reads as the line rising.
const TOP = 50;
const BOTTOM = 112;
const Y_ASLEEP = TOP;
const Y_AWAKE = BOTTOM;
const LANE0 = 132; // first row of dots under the graph
const LANE_H = 13;
const NIGHT_START = 19; // hours shaded as night: 19:00–24:00 and 00:00–07:00
const NIGHT_END = 7;
const LANES: Category[] = ["feeding", "diaper", "pumping", "health"];

interface Seg {
  e: BabyEvent;
  s: number;
  en: number;
}

/**
 * 24h sleep graph for one day: a line that sits on "Awake" and dips to "Asleep" for every sleep,
 * night hours shaded, a dotted sunrise line at the morning wake-up, and feeds/diapers as dots.
 * Time flows in the reading direction (right-to-left in Hebrew).
 */
export function SleepGraph({ events, now, day = new Date() }: { events: BabyEvent[]; now: number; day?: Date }) {
  const { t, lang, profile, settings, openSheet } = useApp();
  const rtl = lang === "he";
  const X0 = rtl ? END : START;
  const X1 = rtl ? W - START : W - END;
  const iconX = rtl ? W - START + 6 : 4;
  const fmt = profile?.time_format ?? "24h";
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + DAY;
  const until = Math.min(now, dayEnd); // the line stops at "now" on today
  const isToday = now < dayEnd;

  const x = (ms: number) => {
    const f = Math.min(1, Math.max(0, (ms - dayStart) / DAY));
    return rtl ? X1 - f * (X1 - X0) : X0 + f * (X1 - X0);
  };
  const xh = (h: number) => x(dayStart + h * HOUR);
  const span = (a: number, b: number) => ({ left: Math.min(x(a), x(b)), width: Math.abs(x(b) - x(a)) });

  // Sleep segments clipped to this day.
  const segs: Seg[] = events
    .filter((e) => e.category === "sleep")
    .map((e) => ({ e, s: Math.max(new Date(e.started_at).getTime(), dayStart), en: Math.min(e.ended_at ? new Date(e.ended_at).getTime() : now, until) }))
    .filter((g) => g.en > g.s)
    .sort((a, b) => a.s - b.s);
  const totalMs = segs.reduce((sum, g) => sum + (g.en - g.s), 0);

  // The step line: awake → drop at each sleep start → asleep → rise at its end.
  let d = `M ${x(dayStart)} ${Y_AWAKE}`;
  for (const g of segs) d += ` L ${x(g.s)} ${Y_AWAKE} L ${x(g.s)} ${Y_ASLEEP} L ${x(g.en)} ${Y_ASLEEP} L ${x(g.en)} ${Y_AWAKE}`;
  const sleepingNow = isToday && segs.some((g) => !g.e.ended_at);
  if (!sleepingNow) d += ` L ${x(until)} ${Y_AWAKE}`;

  // Morning wake-up: the last night sleep that ended this morning (04:00–12:00).
  const wake = segs
    .filter((g) => g.e.subtype === "night" && g.e.ended_at)
    .map((g) => new Date(g.e.ended_at!).getTime())
    .filter((ms) => ms >= dayStart + 4 * HOUR && ms <= dayStart + 12 * HOUR)
    .pop();

  // Other entries, one row per category, following the shared filters.
  const marks = events.filter((e) => e.category !== "sleep"
    && new Date(e.started_at).getTime() >= dayStart && new Date(e.started_at).getTime() < dayEnd);
  const lanes = LANES;
  const laneY = (c: Category) => LANE0 + lanes.indexOf(c) * LANE_H;
  const yLabels = LANE0 + lanes.length * LANE_H + 8;
  const H = yLabels + 10;
  const open = (e: BabyEvent) => openSheet({ kind: "event", event: e, isNew: false });
  const nights = [span(dayStart, dayStart + NIGHT_END * HOUR), span(dayStart + NIGHT_START * HOUR, dayEnd)];

  return (
    <section className="card sleep-graph">
      <div className="sg-head">
        <div>
          <div className="t-sub">{t("totalSleepToday")}</div>
          <div className="t-title1 num" style={{ lineHeight: 1.1 }}>{fmtDuration(totalMs, lang)}</div>
        </div>
        <div className="sg-tools">
          <span className="sg-key"><i style={{ background: "var(--sg-night)" }} />{t("night")}</span>
          <span className="sg-key"><i style={{ background: "var(--sg-nap)" }} />{t("nap")}</span>
          <button className="sg-filter press" aria-label={t("filters")} onClick={() => openSheet({ kind: "filters" })}>
            <SlidersHorizontal size={15} />
          </button>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="sg-svg" role="img" aria-label={`${t("totalSleepToday")}: ${fmtDuration(totalMs, lang)}`}>
        <defs>
          <linearGradient id="sg-night-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--sg-night-band)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--sg-night-band)" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="sg-fill-night" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--sg-night)" stopOpacity="0.75" />
            <stop offset="1" stopColor="var(--sg-night)" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="sg-fill-nap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--sg-nap)" stopOpacity="0.8" />
            <stop offset="1" stopColor="var(--sg-nap)" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="sg-line" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--sg-night)" />
            <stop offset="1" stopColor="var(--sg-awake-line)" />
          </linearGradient>
        </defs>

        {/* Night bands with a moon, the day with a sun */}
        {nights.map((n, i) => (
          <rect key={i} x={n.left} y={14} width={n.width} height={BOTTOM - 14 + 6} rx={10} fill="url(#sg-night-band)" />
        ))}
        <Moon x={xh(NIGHT_END / 2) - 7} y={18} width={14} height={14} color="var(--sg-night)" strokeWidth={2} />
        <Moon x={xh((NIGHT_START + 24) / 2) - 7} y={18} width={14} height={14} color="var(--sg-night)" strokeWidth={2} />
        <Sun x={xh(13) - 7} y={18} width={14} height={14} color="var(--sg-sun)" strokeWidth={2} />

        {/* Hour grid */}
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <line key={h} x1={xh(h)} x2={xh(h)} y1={36} y2={BOTTOM + 6} stroke="var(--separator)" strokeWidth={h % 6 ? 0.5 : 0.8} strokeDasharray={h % 6 ? "2 3" : undefined} />
        ))}
        {[0, 6, 12, 18, 24].map((h) => (
          <text key={h} x={xh(h)} y={yLabels} textAnchor="middle" fontSize="10" fill="var(--label-2)" className="num">
            {String(h % 24 === 0 && h ? 24 : h).padStart(2, "0")}
          </text>
        ))}

        {/* Level guides */}
        <line x1={X0} x2={X1} y1={Y_AWAKE} y2={Y_AWAKE} stroke="var(--sg-awake-line)" strokeOpacity={0.25} strokeWidth={1} />
        <line x1={X0} x2={X1} y1={Y_ASLEEP} y2={Y_ASLEEP} stroke="var(--sg-night)" strokeOpacity={0.2} strokeWidth={1} />
        <text x={rtl ? X1 - 2 : X0 + 2} y={Y_AWAKE + 13} fontSize="9" fill="var(--label-3)" textAnchor={rtl ? "end" : "start"}>{t("awake")}</text>
        <text x={rtl ? X1 - 2 : X0 + 2} y={Y_ASLEEP - 5} fontSize="9" fill="var(--label-3)" textAnchor={rtl ? "end" : "start"}>{t("asleep")}</text>

        {/* Sleep areas (tap to edit) */}
        {segs.map((g) => {
          const sp = span(g.s, g.en);
          return (
            <rect key={g.e.id} className="arc" x={sp.left} y={TOP} width={Math.max(sp.width, 2)} height={BOTTOM - TOP} rx={4}
              fill={g.e.subtype === "night" ? "url(#sg-fill-night)" : "url(#sg-fill-nap)"} onClick={() => open(g.e)}>
              <title>{`${t(g.e.subtype)} ${fmtClock(new Date(g.s), fmt)}–${fmtClock(new Date(g.en), fmt)}`}</title>
            </rect>
          );
        })}

        {/* Future part of today, faint */}
        {isToday && (
          <line x1={x(until)} x2={x(dayEnd)} y1={Y_AWAKE} y2={Y_AWAKE} stroke="var(--label-3)" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="1 5" strokeLinecap="round" />
        )}
        <path d={d} fill="none" stroke="url(#sg-line)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

        {/* Morning wake-up */}
        {wake && (
          <g>
            <line x1={x(wake)} x2={x(wake)} y1={30} y2={BOTTOM + 6} stroke="var(--sg-sun)" strokeWidth={1.5} strokeDasharray="3 3" strokeLinecap="round" />
            <Sunrise x={x(wake) - 8} y={BOTTOM + 10} width={16} height={16} color="var(--sg-sun)" strokeWidth={2} />
            <text x={x(wake)} y={30 - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--sg-sun-text)" className="num">
              {fmtClock(new Date(wake), fmt)}
            </text>
          </g>
        )}

        {/* One row of dots per category, with a small icon at the start */}
        {lanes.map((c) => {
          const Icon = CATEGORY_ICON[c];
          return (
            <g key={c}>
              <line x1={X0} x2={X1} y1={laneY(c)} y2={laneY(c)} stroke={catVar(c)} strokeOpacity={0.18} strokeWidth={1} strokeDasharray="1 4" strokeLinecap="round" />
              <Icon x={iconX} y={laneY(c) - 6} width={12} height={12} color={catVar(c)} strokeWidth={2.2} />
            </g>
          );
        })}
        {marks.map((e) => {
          const hl = settings.historyHighlight.includes(e.subtype);
          const cx = x(new Date(e.started_at).getTime());
          return (
            <circle key={e.id} className="arc" cx={cx} cy={laneY(e.category)} r={hl ? 5 : 4}
              fill={`var(--c-${e.category})`} stroke={hl ? "var(--hl-red)" : "var(--surface)"} strokeWidth={hl ? 2.5 : 1.2}
              onClick={() => open(e)}>
              <title>{t(e.subtype)}</title>
            </circle>
          );
        })}

        {/* Now */}
        {isToday && (
          <g>
            <line x1={x(now)} x2={x(now)} y1={36} y2={yLabels - 8} stroke="var(--label)" strokeOpacity={0.35} strokeWidth={1} />
            <circle cx={x(now)} cy={sleepingNow ? Y_ASLEEP : Y_AWAKE} r={9} fill={sleepingNow ? "var(--sg-night)" : "var(--sg-awake-line)"} opacity={0.2} className="sg-pulse" />
            <circle cx={x(now)} cy={sleepingNow ? Y_ASLEEP : Y_AWAKE} r={4.5} fill={sleepingNow ? "var(--sg-night)" : "var(--sg-awake-line)"} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
    </section>
  );
}
