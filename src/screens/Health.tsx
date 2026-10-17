import { Pill, Ruler, Thermometer } from "lucide-react";
import { useApp, useNow } from "../state/AppContext";
import { EventLog } from "../components/EventLog";
import { fmtClock, fmtDate } from "../lib/time";
import type { Subtype } from "../types";

export function Health() {
  const { t, lang, events, profile, newEvent, openSheet } = useApp();
  const now = useNow(30_000);
  const health = events.filter((e) => e.category === "health");
  const temp = health.find((e) => e.subtype === "temperature");
  const growth = health.find((e) => e.subtype === "growth");
  const add = (sub: Subtype) =>
    openSheet({ kind: "event", event: newEvent("health", sub, sub === "medicine" ? { unit: "ml" } : sub === "temperature" ? { celsius: 37, method: "armpit" } : {}), isNew: true });

  return (
    <div className="screen" style={{ ["--cat" as string]: "var(--c-health)" }}>
      <h1 className="t-large" style={{ margin: 0 }}>{t("health")}</h1>
      <div className="quick" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {([["medicine", Pill, "giveMedicine"], ["temperature", Thermometer, "logTemp"], ["growth", Ruler, "logGrowth"]] as const).map(([s, Icon, l]) => (
          <button key={s} className="press" onClick={() => add(s)}>
            <span className="circle"><Icon size={26} /></span>{t(l)}
          </button>
        ))}
      </div>

      <div className="since">
        <div className="card tinted">
          <div className="head"><Thermometer size={18} />{t("temperature")}</div>
          <div className="val num" style={{ color: temp && (temp.data.celsius ?? 0) >= 38 ? "var(--amber)" : undefined }}>
            {temp?.data.celsius ? `${temp.data.celsius.toFixed(1)} °C` : "—"}
          </div>
          {temp && <div className="t-foot">{fmtDate(new Date(temp.started_at), lang)} · {fmtClock(temp.started_at, profile?.time_format)}</div>}
        </div>
        <div className="card tinted">
          <div className="head"><Ruler size={18} />{t("growth")}</div>
          <div className="val num">{growth?.data.weight_kg ? `${growth.data.weight_kg} kg` : "—"}</div>
          {growth && <div className="t-foot num">{[growth.data.length_cm && `${growth.data.length_cm} cm`, growth.data.head_cm && `⌀ ${growth.data.head_cm} cm`].filter(Boolean).join(" · ")}</div>}
        </div>
      </div>
      {temp && (temp.data.celsius ?? 0) >= 38 && <div className="banner">{t("feverNote")}</div>}

      <EventLog events={health} now={now} empty={t("noHealth")} />
      <div className="group-foot">{t("doseFooter")}</div>
    </div>
  );
}
