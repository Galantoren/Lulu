import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp, useNow } from "../state/AppContext";
import { Seg } from "../components/Sheet";
import { DayRing } from "../components/DayRing";
import { EventLog } from "../components/EventLog";
import { CATEGORY_ORDER, catVar } from "../lib/categories";
import { dayStats } from "../lib/summary";
import { addDays, DAY, fmtDate, fmtDuration, HOUR, overlap, sameDay, startOfDay } from "../lib/time";
import type { BabyEvent, Category } from "../types";

type Range = "day" | "week" | "month";
const SPAN: Record<Range, number> = { day: 1, week: 7, month: 30 };

export function History() {
  const { t, lang, events } = useApp();
  const now = useNow(30_000);
  const [range, setRange] = useState<Range>("day");
  const [offset, setOffset] = useState(0); // periods back from today
  const [filter, setFilter] = useState<Category | "all">("all");

  const span = SPAN[range];
  const lastDay = addDays(startOfDay(), -offset * span);
  const days = Array.from({ length: span }, (_, i) => addDays(lastDay, -i)); // newest first
  const shown = filter === "all" ? events : events.filter((e) => e.category === filter || e.category === "sleep");
  const isRtl = lang === "he";
  const Prev = isRtl ? ChevronRight : ChevronLeft;
  const Next = isRtl ? ChevronLeft : ChevronRight;

  const label = range === "day" ? fmtDate(lastDay, lang) : `${fmtDate(days[days.length - 1]!, lang)} – ${fmtDate(lastDay, lang)}`;

  // Sleep per day, and the same for the period before, for a neutral comparison.
  const sleepHours = (d: Date) => dayStats(events, d, now).sleepMs / HOUR;
  const perDay = days.map((d) => ({ d, h: sleepHours(d) })).reverse();
  const avg = perDay.reduce((a, b) => a + b.h, 0) / perDay.length;
  const prevAvg = Array.from({ length: span }, (_, i) => sleepHours(addDays(lastDay, -span - i))).reduce((a, b) => a + b, 0) / span;
  const hasData = events.some((e) => new Date(e.started_at) >= addDays(lastDay, -span + 1));

  return (
    <div className="screen">
      <h1 className="t-large" style={{ margin: 0 }}>{t("history")}</h1>
      <Seg value={range} onChange={(v) => { setRange(v); setOffset(0); }}
        options={[{ value: "day", label: t("day") }, { value: "week", label: t("week") }, { value: "month", label: t("monthTab") }]} />
      <div className="header" style={{ minHeight: 44 }}>
        <button className="icon-btn" style={{ color: "var(--label)" }} aria-label="previous" onClick={() => setOffset(offset + 1)}><Prev /></button>
        <button className="t-headline" onClick={() => setOffset(0)}>{offset === 0 && range === "day" ? t("today") : label}</button>
        <button className="icon-btn" style={{ color: "var(--label)" }} aria-label="next" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 1))}><Next /></button>
      </div>

      <div className="chips">
        {(["all", ...CATEGORY_ORDER] as const).map((c) => (
          <button key={c} className="chip" aria-pressed={filter === c} style={{ ["--cat" as string]: c === "all" ? "var(--c-sleep)" : catVar(c) }}
            onClick={() => setFilter(c)}>{c === "all" ? t("all") : t(c)}</button>
        ))}
      </div>

      {range === "day" ? (
        <DayView day={lastDay} events={shown} now={now} />
      ) : !hasData ? (
        <div className="group"><div className="empty">{t("emptyHistory")}</div></div>
      ) : (
        <>
          <div className="card">
            <div className="t-headline" style={{ marginBottom: 4 }}>{t("sleepPerDay")}</div>
            <div className="t-foot num" style={{ marginBottom: 12 }}>
              {t("avg")} {fmtDuration(avg * HOUR, lang)}
              {prevAvg > 0 && ` · ${t("vsLastWeek", { diff: `${avg >= prevAvg ? "+" : "−"}${fmtDuration(Math.abs(avg - prevAvg) * HOUR, lang)}` })}`}
            </div>
            <SleepBars data={perDay} avg={avg} />
          </div>
          <div className="card">
            <div className="pattern">
              {days.map((d) => (
                <button key={d.toISOString()} className="day" onClick={() => { setRange("day"); setOffset(Math.round((startOfDay().getTime() - d.getTime()) / DAY)); }}>
                  <span className="t-caption">{fmtDate(d, lang).split(",")[0]} {range === "month" ? d.getDate() : ""}</span>
                  <PatternRow day={d} events={shown} now={now} />
                </button>
              ))}
            </div>
            <div className="t-caption num" style={{ display: "flex", justifyContent: "space-between", marginInlineStart: 64, marginTop: 6 }}>
              <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DayView({ day, events, now }: { day: Date; events: BabyEvent[]; now: number }) {
  const { t, lang } = useApp();
  const s = dayStats(events, day, now);
  const from = startOfDay(day).getTime();
  const list = events.filter((e) => {
    const st = new Date(e.started_at).getTime();
    return (st >= from && st < from + DAY) || (e.category === "sleep" && overlap(e, from, from + DAY, now) > 0 && st < from + DAY);
  });
  return (
    <>
      <DayRing events={events} now={sameDay(day, new Date()) ? now : from + DAY} day={day} />
      <div className="chips">
        <span className="chip" style={{ ["--cat" as string]: catVar("sleep") }}><span className="dot" />{t("sleep")} <b>{fmtDuration(s.sleepMs, lang)}</b></span>
        <span className="chip" style={{ ["--cat" as string]: catVar("feeding") }}><span className="dot" />{t("feeds")} <b>{s.feeds}</b>{s.bottleMl > 0 && <span className="num">· {s.bottleMl} ml</span>}</span>
        <span className="chip" style={{ ["--cat" as string]: catVar("diaper") }}><span className="dot" />{t("diapers")} <b>{s.diapers}</b></span>
        <span className="chip" style={{ ["--cat" as string]: catVar("pumping") }}><span className="dot" />{t("pumped")} <b>{s.pumpedMl} ml</b></span>
      </div>
      <EventLog events={list} now={now} empty={t("emptyHistory")} />
    </>
  );
}

/** One day as a 24h strip; sleep is the base layer so its pattern reads first. */
function PatternRow({ day, events, now }: { day: Date; events: BabyEvent[]; now: number }) {
  const from = startOfDay(day).getTime();
  const to = from + DAY;
  const segs: { left: number; width: number; color: string; z: number }[] = [];
  for (const e of events) {
    const s = Math.max(new Date(e.started_at).getTime(), from);
    const en = Math.min(e.ended_at ? new Date(e.ended_at).getTime() : now, to);
    if (en < from || s >= to) continue;
    const isSleep = e.category === "sleep";
    const color = isSleep ? (e.subtype === "night" ? "var(--c-sleep-night)" : "var(--c-sleep-nap)") : catVar(e.category);
    const width = isSleep ? ((en - s) / DAY) * 100 : Math.max(((en - s) / DAY) * 100, 0.9);
    segs.push({ left: ((s - from) / DAY) * 100, width, color, z: isSleep ? 0 : 1 });
  }
  return (
    <div className="track">
      {segs.map((g, i) => (
        <span key={i} className="seg-bar" style={{ left: `${g.left}%`, width: `${g.width}%`, background: g.color, zIndex: g.z,
          ...(g.z ? { insetBlock: "4px" } : {}) }} />
      ))}
    </div>
  );
}

function SleepBars({ data, avg }: { data: { d: Date; h: number }[]; avg: number }) {
  const max = Math.max(16, ...data.map((x) => x.h));
  const W = 320, H = 140, pad = 18;
  const bw = (W - pad) / data.length;
  const y = (h: number) => H - (h / max) * (H - 10);
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} style={{ width: "100%", direction: "ltr" }} role="img">
      {[0, 4, 8, 12, 16].map((h) => (
        <g key={h}>
          <line x1={pad} x2={W} y1={y(h)} y2={y(h)} stroke="var(--separator)" strokeWidth={0.5} />
          <text x={0} y={y(h) + 3} fontSize="9" fill="var(--label-2)">{h}</text>
        </g>
      ))}
      {data.map(({ d, h }, i) => (
        <g key={i}>
          <rect x={pad + i * bw + bw * 0.18} width={bw * 0.64} y={y(h)} height={Math.max(0, H - y(h))} rx={Math.min(4, bw * 0.3)} fill="var(--c-sleep)" />
          {(data.length <= 7 || i % 5 === 0) && (
            <text x={pad + i * bw + bw / 2} y={H + 12} fontSize="9" textAnchor="middle" fill="var(--label-2)">{d.getDate()}</text>
          )}
        </g>
      ))}
      <line x1={pad} x2={W} y1={y(avg)} y2={y(avg)} stroke="var(--c-sleep-night)" strokeDasharray="4 3" strokeWidth={1.2} />
    </svg>
  );
}
