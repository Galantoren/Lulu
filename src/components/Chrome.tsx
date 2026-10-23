import { useEffect } from "react";
import { CalendarDays, ChartNoAxesColumn, HeartPulse, Menu, Square } from "lucide-react";
import { useApp, useNow } from "../state/AppContext";
import { CATEGORY_ICON, CATEGORY_ORDER, catVar } from "../lib/categories";
import { fmtDuration } from "../lib/time";
import type { TKey } from "../i18n";

export type Tab = "today" | "history" | "health" | "more";

const TABS: { id: Tab; icon: typeof Menu }[] = [
  { id: "today", icon: CalendarDays },
  { id: "history", icon: ChartNoAxesColumn },
  { id: "health", icon: HeartPulse },
  { id: "more", icon: Menu },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useApp();
  return (
    <nav className="tabbar material">
      <div className="inner">
        {TABS.map(({ id, icon: Icon }) => (
          <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => onChange(id)}>
            <Icon size={26} strokeWidth={1.75} />
            {t(id)}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** Floating "now playing" bars for every running timer, plus the toast, above the tab bar. */
export function Dock({ showTimers = true }: { showTimers?: boolean }) {
  const { events, t, lang, stopEvent, openSheet, toast, dismissToast } = useApp();
  const now = useNow(1000);
  const running = events
    .filter((e) => showTimers && !e.ended_at)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismissToast, 5000);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);

  return (
    <div className="dock">
      <div className="inner">
        {toast && (
          <div className="toast" role="status" key={toast.id}>
            <span className="grow">{toast.text}</span>
            {toast.secondary && (
              <button onClick={() => { toast.secondary!.run(); dismissToast(); }}>{toast.secondary.label}</button>
            )}
            {toast.action && <button onClick={() => { toast.action!.run(); dismissToast(); }}>{toast.action.label}</button>}
          </div>
        )}
        {running.map((e) => {
          const Icon = CATEGORY_ICON[e.category];
          const label = e.category === "sleep" ? t("sleep") : t(e.subtype as TKey);
          return (
            <div key={e.id} className="timerbar material press" style={{ ["--cat" as string]: catVar(e.category) }}
              onClick={() => openSheet({ kind: "event", event: e, isNew: false })}>
              <span className="dot" />
              <Icon size={22} color={catVar(e.category)} />
              <span className="t-headline" style={{ flex: 1 }}>{label}</span>
              <span className="t-headline num">{fmtDuration(now - new Date(e.started_at).getTime(), lang, true)}</span>
              <button className="stop" aria-label={t("stop")} onClick={(ev) => { ev.stopPropagation(); stopEvent(e); }}>
                <Square size={16} fill="currentColor" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
