import { useApp } from "../state/AppContext";
import { Sheet, Switch } from "../components/Sheet";
import { CATEGORY_ORDER, catVar } from "../lib/categories";
import type { Category, Subtype } from "../types";

const SUBTYPES: Record<Category, Subtype[]> = {
  sleep: ["night", "nap"],
  feeding: ["breastfeeding", "bottle", "solids"],
  diaper: ["wet", "dirty", "mixed"],
  pumping: [],
  health: ["medicine", "temperature", "growth"],
};

/** History filters: what to show, and which subtypes get a gradient stroke. */
export function FilterSheet({ onClose }: { onClose: () => void }) {
  const { t, settings, setSettings } = useApp();
  const hl = new Set(settings.historyHighlight);
  const toggle = (set: Set<string>, key: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return [...next];
  };

  return (
    <Sheet title={t("filters")} onClose={onClose} cancelLabel={t("done")}>
      <p className="t-foot" style={{ margin: 0 }}>{t("filtersFoot")}</p>
      <section>
        <div className="group-label">{t("highlightTitle")}</div>
        <div className="group">
          {CATEGORY_ORDER.flatMap((c) => SUBTYPES[c].map((s) => (
            <label key={s} className="row">
              {/* Preview of the mark as it appears in the grid */}
              <span className={`hl-swatch ${hl.has(s) ? "hl" : ""}`}
                style={{ ["--fill" as string]: catVar(c) }} />
              <span className="grow">{t(c)} · {t(s)}</span>
              <Switch checked={hl.has(s)} label={t(s)} onChange={(on) => setSettings({ historyHighlight: toggle(hl, s, on) })} />
            </label>
          )))}
        </div>
        <div className="group-foot">{t("highlightFoot")}</div>
      </section>
    </Sheet>
  );
}
