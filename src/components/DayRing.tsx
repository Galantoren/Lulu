import { useApp } from "../state/AppContext";
import { DAY, fmtDuration, startOfDay } from "../lib/time";
import type { BabyEvent } from "../types";

const R = 112; // sleep ring radius
const R_IN = 86; // inner track for feeds, diapers, medicine
const STROKE = 20;

const angle = (ms: number, dayStart: number) => ((ms - dayStart) / DAY) * 360;
const polar = (r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)] as const;
};
function arc(r: number, a0: number, a1: number) {
  const sweep = Math.min(a1 - a0, 359.9);
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a0 + sweep);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** 24h clock-face of today: midnight at the top, sleep as thick arcs, everything else as dots. */
export function DayRing({ events, now, day = new Date() }: { events: BabyEvent[]; now: number; day?: Date }) {
  const { t, lang, openSheet } = useApp();
  const dayStart = startOfDay(day).getTime();
  const dayEnd = Math.min(dayStart + DAY, now);
  const isToday = now < dayStart + DAY;

  let sleepMs = 0;
  const arcs: { e: BabyEvent; a0: number; a1: number }[] = [];
  const dots: { e: BabyEvent; a: number }[] = [];
  for (const e of events) {
    const s = new Date(e.started_at).getTime();
    const en = e.ended_at ? new Date(e.ended_at).getTime() : now;
    if (en < dayStart || s > dayEnd) continue;
    if (e.category === "sleep") {
      const a0 = angle(Math.max(s, dayStart), dayStart);
      const a1 = angle(Math.min(en, dayEnd), dayStart);
      sleepMs += Math.min(en, dayEnd) - Math.max(s, dayStart);
      arcs.push({ e, a0, a1: Math.max(a1, a0 + 1.5) });
    } else if (s >= dayStart) {
      dots.push({ e, a: angle(s, dayStart) });
    }
  }
  const nowA = angle(now, dayStart);
  const open = (e: BabyEvent) => openSheet({ kind: "event", event: e, isNew: false });

  return (
    <div className="ring-wrap">
      <svg viewBox="-150 -150 300 300" role="img" aria-label={`${t("totalSleepToday")}: ${fmtDuration(sleepMs, lang)}`}>
        <circle r={R} fill="none" stroke="var(--fill)" strokeWidth={STROKE} />
        <circle r={R_IN} fill="none" stroke="var(--fill)" strokeWidth={1} strokeDasharray="2 5" />
        {Array.from({ length: 24 }, (_, h) => {
          const [x0, y0] = polar(R + STROKE / 2 + 3, h * 15);
          const [x1, y1] = polar(R + STROKE / 2 + (h % 6 === 0 ? 9 : 6), h * 15);
          return <line key={h} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--label-3)" strokeWidth={h % 6 === 0 ? 1.5 : 1} />;
        })}
        {[0, 6, 12, 18].map((h) => {
          const [x, y] = polar(R + STROKE / 2 + 20, h * 15);
          return (
            <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="var(--label-2)" className="num">
              {String(h).padStart(2, "0")}
            </text>
          );
        })}
        {arcs.map(({ e, a0, a1 }) => (
          <path
            key={e.id}
            className="arc"
            d={arc(R, a0, a1)}
            fill="none"
            stroke={e.subtype === "night" ? "var(--c-sleep-night)" : "var(--c-sleep-nap)"}
            strokeWidth={STROKE}
            strokeLinecap="round"
            onClick={() => open(e)}
          >
            <title>{t(e.subtype)}</title>
          </path>
        ))}
        {dots.map(({ e, a }) => {
          const [x, y] = polar(R_IN, a);
          return (
            <circle key={e.id} cx={x} cy={y} r={e.category === "feeding" ? 6 : 4.5} fill={`var(--c-${e.category})`}
              stroke="var(--surface)" strokeWidth={1.5} className="arc" onClick={() => open(e)}>
              <title>{t(e.subtype)}</title>
            </circle>
          );
        })}
        {isToday && (() => {
          const [x0, y0] = polar(R - STROKE / 2 - 4, nowA);
          const [x1, y1] = polar(R + STROKE / 2 + 4, nowA);
          return <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--label)" strokeWidth={2.5} strokeLinecap="round" />;
        })()}
        <text y={-14} textAnchor="middle" fontSize="12" fill="var(--label-2)">{t("totalSleepToday")}</text>
        <text y={20} textAnchor="middle" fontSize="34" fontWeight="700" fill="var(--label)" className="num">
          {fmtDuration(sleepMs, lang)}
        </text>
      </svg>
    </div>
  );
}
