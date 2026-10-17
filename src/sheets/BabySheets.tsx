import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useApp } from "../state/AppContext";
import { Seg, Sheet } from "../components/Sheet";
import { uuid } from "../lib/backend";
import { ageLabel } from "../lib/age";
import type { Baby } from "../types";

export function BabyForm({ baby, onChange }: { baby: Baby; onChange: (b: Baby) => void }) {
  const { t } = useApp();
  return (
    <>
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
  return (
    <Sheet title={baby ? baby.name : t("addBaby")} onClose={onClose} cancelLabel={t("cancel")} saveLabel={t("save")}
      onSave={b.name.trim() ? () => { saveBaby({ ...b, name: b.name.trim() }); onClose(); } : undefined}>
      <BabyForm baby={b} onChange={setB} />
    </Sheet>
  );
}

export function BabyPickerSheet({ onClose }: { onClose: () => void }) {
  const { t, babies, baby, setSettings, openSheet } = useApp();
  return (
    <Sheet title={t("babies")} onClose={onClose} cancelLabel={t("done")}>
      <div className="group">
        {babies.map((b) => (
          <button key={b.id} className="row press" onClick={() => { setSettings({ activeBabyId: b.id }); onClose(); }}>
            <span className="avatar" style={{ width: 36, height: 36 }}>{b.name.slice(0, 1).toUpperCase()}</span>
            <span className="grow"><div>{b.name}</div><div className="t-foot">{ageLabel(b.birth_date, t)}</div></span>
            {b.id === baby?.id && <Check size={20} color="var(--c-sleep)" />}
          </button>
        ))}
        <button className="row press" onClick={() => openSheet({ kind: "baby", baby: null })}>
          <Plus size={20} color="var(--c-sleep)" /><span className="grow link" style={{ minHeight: 0 }}>{t("addBaby")}</span>
        </button>
      </div>
    </Sheet>
  );
}
