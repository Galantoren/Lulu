import { useState } from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useApp, useNow } from "../state/AppContext";
import { SleepGraph } from "../components/SleepGraph";
import { EventLog } from "../components/EventLog";
import { catVar } from "../lib/categories";
import { WeekGrid, isVisible } from "../components/WeekGrid";
import { dayStats } from "../lib/summary";
import { addDays, DAY, fmtDate, fmtDuration, HOUR, overlap, sameDay, startOfDay } from "../lib/time";
import type { BabyEvent } from "../types";

export function History() {
  const { t, lang, events, settings, openSheet } = useApp();
  const now = useNow(30_000);
  const [week, setWeek] = useState(0); // weeks back from this one
  const [day, setDay] = useState<Date | null>(null);
  const rtl = lang === "he";
  const Back = rtl ? ChevronRight : ChevronLeft;

  const lastDay = addDays(startOfDay(), -week * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(lastDay, i - 6));
  const shown = events.filter((e) => isVisible(e, settings.historyHidden));

  // Sleep per day this week vs the week before, for a neutral comparison.
  const sleepHours = (d: Date) => dayStats(events, d, now).sleepMs / HOUR;
  const perDay = days.map((d) => ({ d, h: sleepHours(d) }));
  const avg = perDay.reduce((a, b) => a + b.h, 0) / 7;
  const prevAvg = days.map((d) => sleepHours(addDays(d, -7))).reduce((a, b) => a + b, 0) / 7;

  return (
    <div className="screen">
      <div className="header">
        <h1 className="t-large" style={{ margin: 0 }}>{t("history")}</h1>
        <button className="filter-btn press" onClick={() => openSheet({ kind: "filters" })}>
          <SlidersHorizontal size={16} />{t("filters")}
          {(settings.historyHidden.length > 0) && <span className="filter-dot" />}
        </button>
      </div>

      {day ? (
        <>
          <div className="header" style={{ minHeight: 44 }}>
            <button className="link" style={{ display: "flex", alignItems: "center", gap: 2 }} onClick={() => setDay(null)}>
              <Back size={20} />{t("backToWeek")}
            </button>
            <span className="t-headline">{sameDay(day, new Date()) ? t("today") : fmtDate(day, lang)}</span>
            <span style={{ width: 60 }} />
          </div>
          <DayView day={day} events={shown} now={now} />
        </>
      ) : (
        <>
          <WeekGrid lastDay={lastDay} now={now} canNext={week > 0} onPrev={() => setWeek(week + 1)}
            onNext={() => setWeek(Math.max(0, week - 1))} onOpenDay={setDay} />
          <div className="card">
            <div className="t-headline" style={{ marginBottom: 4 }}>{t("sleepPerDay")}</div>
            <div className="t-foot num" style={{ marginBottom: 12 }}>
              {t("avg")} {fmtDuration(avg * HOUR, lang)}
              {prevAvg > 0 && ` · ${t("vsLastWeek", { diff: `${avg >= prevAvg ? "+" : "−"}${fmtDuration(Math.abs(avg - prevAvg) * HOUR, lang)}` })}`}
            </div>
            <SleepBars data={perDay} avg={avg} />
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
      <SleepGraph events={events} now={sameDay(day, new Date()) ? now : from + DAY} day={day} />
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
