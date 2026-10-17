import { ChevronRight, Cloud, FileUp, Plus, Smartphone } from "lucide-react";
import { useApp } from "../state/AppContext";
import { Seg, Switch } from "../components/Sheet";
import { ShareInvite } from "./Onboarding";
import { backend } from "../lib/backend";
import { ageLabel } from "../lib/age";

export function More() {
  const { t, lang, profile, family, members, babies, events, settings, setSettings, saveProfile, openSheet } = useApp();
  const cloud = backend.mode === "supabase";
  const Chevron = () => <ChevronRight size={18} color="var(--label-3)" style={{ transform: lang === "he" ? "scaleX(-1)" : undefined }} />;

  function exportCsv() {
    const cols = ["started_at", "ended_at", "category", "subtype", "note", "data"] as const;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = events.map((e) => cols.map((c) => esc(c === "data" ? JSON.stringify(e.data) : e[c])).join(","));
    const blob = new Blob([[cols.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lulu-export.csv";
    a.click();
  }

  return (
    <div className="screen">
      <h1 className="t-large" style={{ margin: 0 }}>{t("more")}</h1>

      <section>
        <div className="group-label">{t("profile")}</div>
        <div className="group">
          <label className="row"><span className="grow">{t("yourName")}</span>
            <input type="text" defaultValue={profile?.display_name} onBlur={(e) => profile && e.target.value.trim() && saveProfile({ ...profile, display_name: e.target.value.trim() })} />
          </label>
          <button className="row press" onClick={() => openSheet({ kind: "import" })}>
            <FileUp size={20} color="var(--c-sleep)" />
            <span className="grow">{t("importHistory")}</span>
            <Chevron />
          </button>
        </div>
      </section>

      <section>
        <div className="group-label">{t("babies")}</div>
        <div className="group">
          {babies.map((b) => (
            <button key={b.id} className="row press" onClick={() => openSheet({ kind: "baby", baby: b })}>
              <span className="avatar" style={{ width: 32, height: 32, fontSize: 14 }}>{b.name.slice(0, 1).toUpperCase()}</span>
              <span className="grow">{b.name}<div className="t-foot">{ageLabel(b.birth_date, t)}</div></span>
              <Chevron />
            </button>
          ))}
          <button className="row press" onClick={() => openSheet({ kind: "baby", baby: null })}>
            <Plus size={20} color="var(--c-sleep)" /><span className="grow link" style={{ minHeight: 0 }}>{t("addBaby")}</span>
          </button>
        </div>
      </section>

      {cloud && family && (
        <section>
          <div className="group-label">{t("family")}</div>
          <div className="group">
            <div className="row"><span className="grow">{t("inviteCode")}</span><b className="num" style={{ letterSpacing: "0.15em" }}>{family.invite_code}</b></div>
            <div className="row"><span className="grow">{t("members")}</span><span className="muted">{members.map((m) => m.display_name).join(", ")}</span></div>
          </div>
          <div style={{ marginTop: 12 }}><ShareInvite code={family.invite_code} /></div>
        </section>
      )}

      <section>
        <div className="group-label">{t("settings")}</div>
        <div className="group">
          <div className="row"><span className="grow">{t("language")}</span>
            <div style={{ width: 170 }}>
              <Seg value={lang} onChange={(v) => profile && saveProfile({ ...profile, language: v })}
                options={[{ value: "en", label: "English" }, { value: "he", label: "עברית" }]} />
            </div>
          </div>
          <div className="row"><span className="grow">{t("timeFormat")}</span>
            <div style={{ width: 130 }}>
              <Seg value={profile?.time_format ?? "24h"} onChange={(v) => profile && saveProfile({ ...profile, time_format: v })}
                options={[{ value: "24h", label: "24h" }, { value: "12h", label: "12h" }]} />
            </div>
          </div>
          <div className="row"><span className="grow">{t("appearance")}</span>
            <div style={{ width: 210 }}>
              <Seg value={settings.appearance} onChange={(v) => setSettings({ appearance: v })}
                options={[{ value: "system", label: t("system") }, { value: "light", label: t("light") }, { value: "dark", label: t("dark") }]} />
            </div>
          </div>
          <div className="row"><span className="grow">{t("nightMode")}</span>
            <Switch checked={settings.nightMode} onChange={(v) => setSettings({ nightMode: v })} label={t("nightMode")} />
          </div>
        </div>
      </section>

      <section>
        <div className="group-label">{t("storage")}</div>
        <div className="group">
          <div className="row">
            {cloud ? <Cloud size={20} color="var(--c-health)" /> : <Smartphone size={20} color="var(--label-2)" />}
            <span className="grow">{cloud ? t("cloudSync") : t("onDevice")}</span>
          </div>
          <button className="row press" onClick={exportCsv}><span className="grow">{t("exportCsv")}</span><Chevron /></button>
        </div>
        {!cloud && <div className="group-foot">{t("onDeviceNote")}</div>}
      </section>

      {cloud && (
        <div className="group">
          <button className="row press" style={{ color: "var(--danger)", justifyContent: "center" }} onClick={() => backend.signOut()}>{t("signOut")}</button>
        </div>
      )}
    </div>
  );
}
