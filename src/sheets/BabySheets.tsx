import { useRef, useState } from "react";
import { Camera, Check, Pencil, Plus } from "lucide-react";
import { useApp } from "../state/AppContext";
import { Seg, Sheet } from "../components/Sheet";
import { backend, uuid } from "../lib/backend";
import { compressImage } from "../lib/image";
import { BabyAvatar } from "../components/BabyAvatar";
import { ageLabel } from "../lib/age";
import type { Baby } from "../types";

/** Big tappable avatar: pick a photo from the phone's library/camera or a computer's files. */
function BabyPhotoPicker({ baby, onChange }: { baby: Baby; onChange: (b: Baby) => void }) {
  const { t, family } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onFile(file?: File) {
    const familyId = baby.family_id || family?.id;
    if (!file || !familyId) return;
    setBusy(true);
    setErr("");
    try {
      const blob = await compressImage(file, 800, 0.85);
      onChange({ ...baby, photo_path: await backend.uploadPhoto(familyId, blob) });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="baby-photo">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <button className="baby-photo-btn press" disabled={busy} aria-label={t("babyPhoto")} onClick={() => fileRef.current?.click()}>
        <BabyAvatar baby={{ name: baby.name || "?", photo_path: baby.photo_path }} size={96} />
        <span className="baby-photo-cam"><Camera size={16} /></span>
      </button>
      <div className="baby-photo-actions">
        <button className="link" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "…" : baby.photo_path ? t("changePhoto") : t("addPhoto")}
        </button>
        {baby.photo_path && !busy && (
          <button className="link" style={{ color: "var(--danger)", fontWeight: 400 }} onClick={() => onChange({ ...baby, photo_path: null })}>
            {t("removePhoto")}
          </button>
        )}
      </div>
      {err && <p className="t-foot" style={{ margin: 0, color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}

export function BabyForm({ baby, onChange }: { baby: Baby; onChange: (b: Baby) => void }) {
  const { t } = useApp();
  return (
    <>
      <BabyPhotoPicker baby={baby} onChange={onChange} />
      <div className="group">
        <label className="row"><span className="grow">{t("babyName")}</span>
          <input type="text" value={baby.name} autoFocus placeholder="Mila" onChange={(e) => onChange({ ...baby, name: e.target.value })} />
        </label>
        <label className="row"><span className="grow">{t("birthDate")}</span>
          <input type="date" value={baby.birth_date ?? ""} max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onChange({ ...baby, birth_date: e.target.value || null })} />
        </label>
      </div>
      <div>
        <div className="group-label">{t("sex")}</div>
        <Seg value={baby.sex ?? ("" as never)} onChange={(v) => onChange({ ...baby, sex: v })}
          options={[{ value: "female", label: t("girl") }, { value: "male", label: t("boy") }]} />
      </div>
    </>
  );
}

export function BabyEditSheet({ baby, onClose }: { baby: Baby | null; onClose: () => void }) {
  const { t, family, saveBaby } = useApp();
  const [b, setB] = useState<Baby>(baby ?? { id: uuid(), family_id: family!.id, name: "", birth_date: null, sex: null });
  const [err, setErr] = useState("");
  const save = async () => {
    try {
      await saveBaby({ ...b, name: b.name.trim() });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Sheet title={baby ? baby.name : t("addBaby")} onClose={onClose} cancelLabel={t("cancel")} saveLabel={t("save")}
      onSave={b.name.trim() ? save : undefined}>
      <BabyForm baby={b} onChange={setB} />
      {err && <p className="t-foot" role="alert" style={{ margin: 0, color: "var(--danger)" }}>{err}</p>}
    </Sheet>
  );
}

export function BabyPickerSheet({ onClose }: { onClose: () => void }) {
  const { t, babies, baby, setSettings, openSheet } = useApp();
  return (
    <Sheet title={t("babies")} onClose={onClose} cancelLabel={t("done")}>
      <div className="group">
        {babies.map((b) => (
          <div key={b.id} className="row press" role="button" tabIndex={0} onClick={() => { setSettings({ activeBabyId: b.id }); onClose(); }}>
            <BabyAvatar baby={b} size={40} />
            <span className="grow"><div>{b.name}</div><div className="t-foot">{ageLabel(b.birth_date, t)}</div></span>
            {b.id === baby?.id && <Check size={20} color="var(--c-sleep)" />}
            <button className="icon-btn" aria-label={t("edit")} onClick={(e) => { e.stopPropagation(); openSheet({ kind: "baby", baby: b }); }}>
              <Pencil size={17} />
            </button>
          </div>
        ))}
        <button className="row press" onClick={() => openSheet({ kind: "baby", baby: null })}>
          <Plus size={20} color="var(--c-sleep)" /><span className="grow link" style={{ minHeight: 0 }}>{t("addBaby")}</span>
        </button>
      </div>
    </Sheet>
  );
}
