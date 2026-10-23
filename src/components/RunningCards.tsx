import { useEffect, useRef, useState } from "react";
import { Moon, Square, Sun } from "lucide-react";
import { useApp } from "../state/AppContext";
import { CATEGORY_ICON, CATEGORY_ORDER, catVar } from "../lib/categories";
import { sideSeconds } from "../lib/feeding";
import { dayStats, longestNight } from "../lib/summary";
import { fmtClock, fmtDuration } from "../lib/time";
import type { BabyEvent } from "../types";
import type { TKey } from "../i18n";

const EXIT_MS = 380;

/** Keeps the last value around briefly after it goes away, so its card can animate out. */
function usePresence<T>(value: T | null): { item: T | null; leaving: boolean } {
  const [kept, setKept] = useState<T | null>(value);
  const timer = useRef<number>(undefined);
  useEffect(() => {
    if (value) {
      window.clearTimeout(timer.current);
      setKept(value);
    } else if (kept) {
      timer.current = window.setTimeout(() => setKept(null), EXIT_MS);
    }
    return () => window.clearTimeout(timer.current);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return { item: value ?? kept, leaving: !value && !!kept };
}

/** Running timers at the top of Today: the big glass card for sleep, one slim line for anything else. */
export function RunningCards({ now }: { now: number }) {
  const { events } = useApp();
  const sleep = events.find((e) => e.category === "sleep" && !e.ended_at) ?? null;
  const others = events
    .filter((e) => e.category !== "sleep" && !e.ended_at)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
  const sleepCard = usePresence(sleep);
  return (
    <>
      {sleepCard.item && <SleepHero e={sleepCard.item} leaving={sleepCard.leaving} now={now} />}
      {others.map((e) => <TimerLine key={e.id} e={e} now={now} />)}
    </>
  );
}

function SleepHero({ e, leaving, now }: { e: BabyEvent; leaving: boolean; now: number }) {
  const { t, lang, events, profile, stopEvent } = useApp();
  const stats = dayStats(events, new Date(), now);
  return (
    <div className={`slide-wrap ${leaving ? "out" : ""}`}>
      <section className="hero asleep">
        <span className="hero-blob b1" aria-hidden />
        <span className="hero-blob b2" aria-hidden />
        <span className="hero-stars" aria-hidden />
        <div className="hero-top">
          <span className="hero-badge"><Moon size={18} />{t("asleep")}</span>
          <span className="hero-since num">{t("since", { time: fmtClock(e.started_at, profile?.time_format) })}</span>
        </div>
        <div className="big num">{fmtDuration(now - new Date(e.started_at).getTime(), lang)}</div>
        <button className="glass-btn block press" disabled={leaving} onClick={() => stopEvent(e)}>
          <Sun size={20} />{t("wakeUp")}
        </button>
        <div className="stats">
          <div><small>{t("totalSleepToday")}</small><b className="num">{fmtDuration(stats.sleepMs, lang)}</b></div>
          <div><small>{t("naps")}</small><b className="num">{stats.naps}</b></div>
          <div><small>{t("longestNight")}</small><b className="num">{fmtDuration(longestNight(events, now), lang)}</b></div>
        </div>
      </section>
    </div>
  );
}

/** Feeding / pumping timer as a single glassy line: icon, what, live time, stop. */
function TimerLine({ e, now }: { e: BabyEvent; now: number }) {
  const { t, lang, stopEvent, openSheet } = useApp();
  const Icon = CATEGORY_ICON[e.category];
  const side = e.subtype === "breastfeeding" && e.data.active_side ? ` · ${t(e.data.active_side === "L" ? "left" : "right")}` : "";
  const elapsed = e.subtype === "breastfeeding"
    ? (() => { const s = sideSeconds(e, now); return (s.L + s.R) * 1000; })()
    : now - new Date(e.started_at).getTime();
  return (
    <div className="slide-wrap">
      <div className="timer-line press" role="button" tabIndex={0} style={{ ["--cat" as string]: catVar(e.category) }}
        onClick={() => openSheet({ kind: "event", event: e, isNew: false })}>
        <span className="tl-icon"><Icon size={18} /></span>
        <span className="tl-label">{t(e.subtype as TKey)}{side}</span>
        <span className="tl-time num">{fmtDuration(elapsed, lang, true)}</span>
        <button className="stop-btn" aria-label={t("stop")} onClick={(ev) => { ev.stopPropagation(); stopEvent(e); }}>
          <Square size={13} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
