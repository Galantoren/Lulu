import { useEffect, useState } from "react";
import { AlertCircle, Eraser, HeartPulse, Pill, Thermometer } from "lucide-react";
import { useApp, useNow } from "../state/AppContext";
import { CATEGORY_ICON, CATEGORY_ORDER, LONG_RUNNING_HOURS, catVar, suggestMeal, suggestSleepType } from "../lib/categories";
import { SleepGraph } from "../components/SleepGraph";
import { ThemeToggle } from "../components/ThemeToggle";
import { RunningCards } from "../components/RunningCards";
import { BabyAvatar } from "../components/BabyAvatar";
import { EventLog } from "../components/EventLog";
import { ageLabel } from "../lib/age";
import { eventTitle } from "../lib/summary";
import { otherSide } from "../lib/feeding";
import { fmtDuration, HOUR, startOfDay } from "../lib/time";
import type { BabyEvent, Category, Side } from "../types";
import type { TKey } from "../i18n";

export function Today() {
  const app = useApp();
  const { t, lang, baby, events, settings, setSettings, startTimer, stopEvent, saveEvent, newEvent, openSheet, showToast } = app;
  const now = useNow(1000);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  if (!baby) return null;

  const running = (c: Category) => events.find((e) => e.category === c && !e.ended_at);
  const last = (c: Category) => events.find((e) => e.category === c);
  const todayStart = startOfDay().getTime();
  const todays = events.filter((e) => new Date(e.started_at).getTime() >= todayStart || !e.ended_at);

  const lastBreast = events.find((e) => e.subtype === "breastfeeding" && e.ended_at);
  const nextSide: Side = lastBreast?.data.last_side ? otherSide(lastBreast.data.last_side) : "L";

  const undoStart = (e: BabyEvent, label: string) =>
    showToast({
      text: label,
      action: { label: t("undo"), run: () => saveEvent({ ...e, deleted_at: new Date().toISOString() }) },
      secondary: { label: t("details"), run: () => openSheet({ kind: "event", event: e, isNew: false }) },
    });

  /** Every quick-add is one tap: timers start running, a diaper logs as Wet. Details are optional. */
  async function quick(c: Category) {
    navigator.vibrate?.(10);
    const r = running(c);
    if (c === "sleep") {
      if (r) return stopEvent(r);
      const e = await startTimer("sleep", suggestSleepType());
      return undoStart(e, t("started", { what: t("sleep") }));
    }
    if (r) return openSheet({ kind: "event", event: r, isNew: false });
    if (c === "feeding") {
      const sub = settings.lastFeedSubtype;
      const iso = new Date().toISOString();
      const data =
        sub === "breastfeeding" ? { sides: { L: 0, R: 0 }, active_side: nextSide, side_since: iso }
        : sub === "bottle" ? { milk_type: settings.lastMilkType, amount_ml: settings.lastBottleMl }
        : { meal: suggestMeal() };
      const e = await startTimer("feeding", sub, data);
      const what = sub === "breastfeeding" ? `${t("breastfeeding")} · ${t(nextSide === "L" ? "left" : "right")}` : t(sub);
      return undoStart(e, t("started", { what }));
    }
    if (c === "pumping") {
      const e = await startTimer("pumping", "pumping", { left_ml: 0, right_ml: 0 });
      return undoStart(e, t("started", { what: t("pumping") }));
    }
    if (c === "diaper") return openSheet({ kind: "event", event: newEvent("diaper", "wet"), isNew: true });
    openSheet({ kind: "event", event: newEvent("health", "medicine", { unit: "ml" }), isNew: true });
  }

  const ago = (e?: BabyEvent) => {
    if (!e) return "—";
    if (!e.ended_at) return `${t("now")} · ${fmtDuration(now - new Date(e.started_at).getTime(), lang)}`;
    return t("ago", { t: fmtDuration(now - new Date(e.ended_at).getTime(), lang) });
  };

  const longRunning = events.find((e) => {
    const lim = LONG_RUNNING_HOURS[e.category];
    return !e.ended_at && lim && now - new Date(e.started_at).getTime() > lim * HOUR;
  });

  const sinceCards: { c: Category; title: TKey; e?: BabyEvent; extra?: string }[] = [
    { c: "feeding", title: "lastFeed", e: last("feeding"), extra: lastBreast ? t("nextSide", { side: t(nextSide === "L" ? "left" : "right") }) : undefined },
    { c: "diaper", title: "lastDiaper", e: last("diaper") },
    { c: "pumping", title: "lastPump", e: last("pumping") },
  ];
  // Entries older than this are "stale": their cards fade so fresh information stands out.
  const isStale = (e?: BabyEvent) => !e || (!!e.ended_at && now - new Date(e.ended_at).getTime() > 24 * HOUR);
  // The eraser hides older medicine/temperature from the card (the entries stay in History).
  const clearedAt = settings.healthClearedAt[baby.id] ?? "";
  const lastMed = events.find((e) => e.subtype === "medicine" && e.started_at > clearedAt);
  const lastTemp = events.find((e) => e.subtype === "temperature" && e.started_at > clearedAt);
  const eraseHealth = () => {
    const prev = settings.healthClearedAt;
    setSettings({ healthClearedAt: { ...prev, [baby.id]: new Date().toISOString() } });
    showToast({ text: t("cleared"), action: { label: t("undo"), run: () => setSettings({ healthClearedAt: prev }) } });
  };

  return (
    <>
      <div className={`nav-inline ${scrolled ? "show" : ""}`}>{t("today")}</div>
      <div className="screen">
        <div className="header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="t-large" style={{ margin: 0 }}>{t("today")}</h1>
            <ThemeToggle />
          </div>
          <button className="baby-chip press" onClick={() => openSheet({ kind: "babies" })}>
            <BabyAvatar baby={baby} />
            <span>
              <div className="t-headline">{baby.name}</div>
              <div className="t-sub">{ageLabel(baby.birth_date, t)}</div>
            </span>
          </button>
        </div>

        {/* Running timers only: the sleep card slides in while sleep runs, other timers as one line */}
        <RunningCards now={now} />

        {/* Quick add — right under the sleep card, thumb-reachable */}
        <div className="quick">
          {CATEGORY_ORDER.map((c) => {
            const Icon = CATEGORY_ICON[c];
            const on = !!running(c);
            return (
              <button key={c} className="press" style={{ ["--cat" as string]: catVar(c) }} onClick={() => quick(c)}
                aria-label={t(c)}>
                <span className={`circle ${on ? "on" : ""}`}>
                  <Icon size={28} strokeWidth={1.9} />
                  {on && <span className="live" />}
                </span>
                {t(c)}
              </button>
            );
          })}
        </div>

        {longRunning && (
          <div className="banner">
            <AlertCircle size={20} color="var(--amber)" />
            <span style={{ flex: 1 }}>
              {t("stillRunning", { what: t(longRunning.category), t: fmtDuration(now - new Date(longRunning.started_at).getTime(), lang) })}
            </span>
            <button className="link" onClick={() => openSheet({ kind: "event", event: longRunning, isNew: false })}>{t("adjust")}</button>
          </div>
        )}

        <SleepGraph events={events} now={now} />

        <div className="since">
          {sinceCards.map(({ c, title, e, extra }) => {
            const Icon = CATEGORY_ICON[c];
            return (
              <button key={c} className={`card tinted press ${isStale(e) ? "stale" : ""}`} style={{ ["--cat" as string]: catVar(c) }}
                onClick={() => (e ? openSheet({ kind: "event", event: e, isNew: false }) : quick(c))}>
                <div className="head"><Icon size={18} />{t(title)}</div>
                <div className="val num">{ago(e)}</div>
                {e && <div className="t-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eventTitle(e, t, lang, now)}</div>}
                {extra && <div className="t-foot" style={{ fontWeight: 600 }}>{extra}</div>}
              </button>
            );
          })}
          {/* Medicine and temperature share a card, each with its own time */}
          <div role="button" tabIndex={0} className={`card tinted press med-card ${isStale(lastMed) && isStale(lastTemp) ? "stale" : ""}`}
            style={{ ["--cat" as string]: catVar("health") }}
            onClick={() => openSheet({ kind: "event", event: newEvent("health", "medicine", { unit: "ml" }), isNew: true })}>
            <div className="head" style={{ whiteSpace: "nowrap" }}><HeartPulse size={18} />{t("medTemp")}</div>
            {(lastMed || lastTemp) && (
              <button className="eraser" aria-label={t("clearCard")} onClick={(ev) => { ev.stopPropagation(); eraseHealth(); }}>
                <Eraser size={15} />
              </button>
            )}
            <div className={`med-item ${isStale(lastMed) ? "stale-line" : ""}`}>
              <div className="med-line"><Pill size={15} /><span className="num">{lastMed ? ago(lastMed) : "—"}</span></div>
              {lastMed && <div className="t-foot ellipsis">{eventTitle(lastMed, t, lang, now)}</div>}
            </div>
            <div className={`med-item ${isStale(lastTemp) ? "stale-line" : ""}`}>
              <div className="med-line" style={{ color: (lastTemp?.data.celsius ?? 0) >= 38 ? "var(--amber)" : undefined }}>
                <Thermometer size={15} /><span className="num">{lastTemp?.data.celsius ? `${lastTemp.data.celsius.toFixed(1)} °C` : "—"}</span>
              </div>
              {lastTemp && <div className="t-foot num">{ago(lastTemp)}</div>}
            </div>
          </div>
        </div>

        <h2 className="section-title">{t("todaysLog")}</h2>
        <EventLog events={todays} now={now} empty={t("emptyLog")} />
      </div>
    </>
  );
}
