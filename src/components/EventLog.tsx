import { Trash2 } from "lucide-react";
import { useApp } from "../state/AppContext";
import { CATEGORY_ICON, catVar } from "../lib/categories";
import { eventTitle, hasDuration } from "../lib/summary";
import { fmtClock, fmtDuration } from "../lib/time";
import { Photo } from "./Photo";
import type { BabyEvent } from "../types";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "•";

/** Grouped inset list of events, newest first. Tap to edit; trash deletes with Undo. */
export function EventLog({ events, now, empty }: { events: BabyEvent[]; now: number; empty: string }) {
  const { t, lang, profile, openSheet, deleteEvent, memberName } = useApp();
  const fmt = profile?.time_format ?? "24h";
  if (!events.length) return <div className="group"><div className="empty">{empty}</div></div>;
  return (
    <div className="group">
      {events.map((e) => {
        const Icon = CATEGORY_ICON[e.category];
        const end = e.ended_at ? new Date(e.ended_at).getTime() : now;
        const dur = end - new Date(e.started_at).getTime();
        return (
          <div key={e.id} className="row indent press" role="button" tabIndex={0}
            style={{ ["--cat" as string]: catVar(e.category) }}
            onClick={() => openSheet({ kind: "event", event: e, isNew: false })}
            onKeyDown={(k) => k.key === "Enter" && openSheet({ kind: "event", event: e, isNew: false })}>
            <span className="log-icon"><Icon size={18} strokeWidth={2} /></span>
            <div className="grow">
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eventTitle(e, t, lang, now)}</div>
              <div className="t-foot num" style={{ direction: lang === "he" ? "rtl" : "ltr" }}>
                {fmtClock(e.started_at, fmt)}
                {hasDuration(e) && e.ended_at && e.ended_at !== e.started_at && ` – ${fmtClock(e.ended_at, fmt)} · ${fmtDuration(dur, lang)}`}
                {!e.ended_at && ` · ${t("running")} ${fmtDuration(dur, lang)}`}
              </div>
            </div>
            {e.photo_path && <Photo path={e.photo_path} className="thumb" />}
            <span className="avatar sm" title={memberName(e.logged_by)}>{initials(memberName(e.logged_by))}</span>
            <button className="icon-btn" aria-label={t("delete")} onClick={(ev) => { ev.stopPropagation(); deleteEvent(e); }}>
              <Trash2 size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
