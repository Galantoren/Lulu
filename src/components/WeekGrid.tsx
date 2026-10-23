import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "../state/AppContext";
import { catVar } from "../lib/categories";
import { eventTitle } from "../lib/summary";
import { addDays, DAY, fmtDate, sameDay, startOfDay } from "../lib/time";
import type { BabyEvent, Category } from "../types";

const HOUR_PX = 22;
const NIGHT_START = 19;
const NIGHT_END = 7;

/** Second colour of each category's highlight gradient. */
export const ACCENT: Record<Category, string> = {
  sleep: "#c9a7f2",
  feeding: "#f6c560",
  diaper: "#a8703f",
  pumping: "#f4a6c9",
  health: "#f2b84b",
};

export const isVisible = (e: BabyEvent, hidden: string[]) => !hidden.includes(e.category) && !hidden.includes(e.subtype);

/**
 * Week at a glance: one column per day, 24h top to bottom. Sleep is drawn as blocks, everything
 * else as thin bars on top. Subtypes chosen in Filters get a gradient stroke.
 */
export function WeekGrid({ lastDay, now, onPrev, onNext, canNext, onOpenDay }: {
  lastDay: Date;
  now: number;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
  onOpenDay: (d: Date) => void;
}) {
  const { t, lang, events, settings, profile, openSheet } = useApp();
  const days = Array.from({ length: 7 }, (_, i) => addDays(lastDay, i - 6)); // oldest → newest
  const shown = events.filter((e) => isVisible(e, settings.historyHidden));
  const h12 = profile?.time_format === "12h";
  const rtl = lang === "he";
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  const today = new Date();

  const hourLabel = (h: number) => {
    if (!h12) return String(h % 24).padStart(2, "0");
    const hh = h % 12 || 12;
    return h % 12 === 0 ? `${hh} ${h % 24 < 12 ? "AM" : "PM"}` : String(hh);
  };

  return (
    <div className="card wk">
      <div className="wk-head">
        <button className="wk-nav" aria-label="previous week" onClick={onPrev}><Prev size={18} /></button>
        {days.map((d) => (
          <button key={d.toISOString()} className={`wk-day ${sameDay(d, today) ? "today" : ""}`} onClick={() => onOpenDay(d)}>
            <span>{rtl ? d.toLocaleDateString("he-IL", { weekday: "narrow" }) : d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
            <b className="num">{d.getDate()}</b>
          </button>
        ))}
        <button className="wk-nav" aria-label="next week" disabled={!canNext} onClick={onNext}><Next size={18} /></button>
      </div>

      <div className="wk-body" style={{ height: 24 * HOUR_PX }}>
        {/* Night shading and hour lines run across all columns */}
        <div className="wk-night" style={{ top: 0, height: NIGHT_END * HOUR_PX }} />
        <div className="wk-night" style={{ top: NIGHT_START * HOUR_PX, height: (24 - NIGHT_START) * HOUR_PX }} />
        {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
          <div key={h} className={`wk-hour ${h % 6 ? "minor" : ""}`} style={{ top: h * HOUR_PX }}>
            <span className="num">{hourLabel(h)}</span>
          </div>
        ))}

        <div className="wk-cols">
          {days.map((d) => {
            const from = startOfDay(d).getTime();
            const to = from + DAY;
            const isToday = sameDay(d, today);
            const dayEvents = shown.filter((e) => {
              const s = new Date(e.started_at).getTime();
              const en = e.ended_at ? new Date(e.ended_at).getTime() : now;
              return en >= from && s < to;
            });
            // Sleep first so the other marks sit on top of it.
            dayEvents.sort((a, b) => Number(b.category === "sleep") - Number(a.category === "sleep"));
            return (
              <div key={from} className={`wk-col ${isToday ? "today" : ""}`}>
                {dayEvents.map((e) => {
                  const s = Math.max(new Date(e.started_at).getTime(), from);
                  const en = Math.min(e.ended_at ? new Date(e.ended_at).getTime() : now, to);
                  const top = ((s - from) / DAY) * 100;
                  const hl = settings.historyHighlight.includes(e.subtype);
                  const kind = e.category === "sleep" ? "sleep" : e.category === "diaper" || e.category === "health" ? "mark" : "bar";
                  const heightPct = ((en - s) / DAY) * 100;
                  const fill = e.category === "sleep" ? (e.subtype === "night" ? "var(--wk-night)" : "var(--wk-nap)") : catVar(e.category);
                  return (
                    <button key={e.id} className={`wk-ev ${kind} ${hl ? "hl" : ""}`} title={eventTitle(e, t, lang, now)}
                      aria-label={eventTitle(e, t, lang, now)}
                      style={{
                        top: `${top}%`,
                        height: kind === "sleep" || (kind === "bar" && en - s > 20 * 60_000) ? `${heightPct}%` : undefined,
                        ["--fill" as string]: fill,
                        ["--c1" as string]: catVar(e.category),
                        ["--c2" as string]: ACCENT[e.category],
                      }}
                      onClick={() => openSheet({ kind: "event", event: e, isNew: false })} />
                  );
                })}
                {isToday && now < to && (
                  <div className="wk-now" style={{ top: `${((now - from) / DAY) * 100}%` }}><i /></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="wk-foot t-caption">{fmtDate(days[0]!, lang)} – {fmtDate(days[6]!, lang)} · {t("tapDay")}</div>
    </div>
  );
}
