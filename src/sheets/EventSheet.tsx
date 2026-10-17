import { useRef, useState, type ReactNode } from "react";
import { Camera, Minus, Pause, Plus, Square, X } from "lucide-react";
import { useApp, useNow } from "../state/AppContext";
import { Seg, Sheet, Switch } from "../components/Sheet";
import { Photo } from "../components/Photo";
import { backend } from "../lib/backend";
import { compressImage } from "../lib/image";
import { otherSide, sideSeconds, withSide } from "../lib/feeding";
import { suggestMeal } from "../lib/categories";
import { hasDuration } from "../lib/summary";
import { fmtDuration, fromLocalInput, toLocalInput } from "../lib/time";
import type { BabyEvent, EventData, Side, Subtype } from "../types";
import type { TKey } from "../i18n";

const LOCATIONS = ["crib", "stroller", "car", "arms", "bed"] as const;
const TEXTURES = ["watery", "runny", "seedy", "soft", "formed", "hard"] as const;
const DIAPER_COLORS = ["#E8D36A", "#C9A24B", "#8A6A3B", "#6B8E3D", "#4A3B2A", "#C0392B"];

export function EventSheet({ initial, isNew, onClose }: { initial: BabyEvent; isNew: boolean; onClose: () => void }) {
  const { t, lang, baby, family, events, settings, setSettings, saveEvent, deleteEvent, showToast } = useApp();
  const now = useNow(1000);
  const [e, setE] = useState<BabyEvent>(initial);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const running = !e.ended_at;
  const d = e.data;

  const set = (patch: Partial<BabyEvent>) => setE((x) => ({ ...x, ...patch }));
  const setData = (patch: EventData) => setE((x) => ({ ...x, data: { ...x.data, ...patch } }));

  /** Running timers save immediately so the other parent sees the change live. */
  const liveUpdate = (next: BabyEvent) => {
    setE(next);
    if (!isNew && running) saveEvent(next);
  };

  function switchFeedType(sub: Subtype) {
    const base: EventData =
      sub === "breastfeeding" ? { sides: { L: 0, R: 0 }, active_side: running ? lastSideHint() : null, side_since: running ? new Date().toISOString() : null }
      : sub === "bottle" ? { milk_type: settings.lastMilkType, amount_ml: settings.lastBottleMl, formula_brand: settings.lastBrand || undefined }
      : { meal: suggestMeal(new Date(e.started_at)) };
    set({ subtype: sub, data: base });
  }

  const lastBreast = events.find((x) => x.subtype === "breastfeeding" && x.ended_at && x.id !== e.id);
  const lastSideHint = (): Side => (lastBreast?.data.last_side ? otherSide(lastBreast.data.last_side) : "L");

  async function onPhoto(file?: File) {
    if (!file || !family) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      set({ photo_path: await backend.uploadPhoto(family.id, blob) });
    } catch (err) {
      console.error(err);
      showToast({ text: t("couldntSync") });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    let out = { ...e };
    if (!hasDuration(out) && out.ended_at !== out.started_at) out.ended_at = out.started_at;
    if (out.subtype === "breastfeeding" && out.ended_at) out = { ...withSide(out, null, Date.now()), ended_at: out.ended_at };
    if (out.category === "feeding") {
      setSettings({
        lastFeedSubtype: out.subtype as "breastfeeding" | "bottle" | "solids",
        ...(out.subtype === "bottle" && {
          lastBottleMl: out.data.amount_ml ?? settings.lastBottleMl,
          lastMilkType: out.data.milk_type ?? settings.lastMilkType,
          lastBrand: out.data.formula_brand ?? settings.lastBrand,
        }),
      });
    }
    await saveEvent(out);
    navigator.vibrate?.(10);
    if (isNew) {
      showToast({ text: t("logged"), action: { label: t("undo"), run: () => saveEvent({ ...out, deleted_at: new Date().toISOString() }) } });
    }
    onClose();
  }

  function stopNow() {
    const n = Date.now();
    let next: BabyEvent = { ...e, ended_at: new Date(n).toISOString() };
    if (next.subtype === "breastfeeding") next = { ...withSide(next, null, n), ended_at: next.ended_at };
    setE(next);
  }

  // No `capture` attribute: iPhone then offers both "Take photo" and the photo library.
  const photoField = (
    <>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(ev) => { onPhoto(ev.target.files?.[0]); ev.target.value = ""; }} />
      {e.photo_path ? (
        <div>
          <Photo path={e.photo_path} className="photo-preview" />
          <button className="btn plain block" style={{ marginTop: 8 }} onClick={() => set({ photo_path: null })}><X size={18} />{t("removePhoto")}</button>
        </div>
      ) : (
        <button className="btn soft block press" disabled={busy} onClick={() => fileRef.current?.click()}><Camera size={20} />{busy ? "…" : t("addPhoto")}</button>
      )}
    </>
  );

  const title = isNew ? t(e.category) : t(e.category === "sleep" ? "sleep" : (e.subtype as TKey));

  return (
    <Sheet title={title} onClose={onClose} onSave={busy ? undefined : save} saveLabel={t("save")} cancelLabel={t("cancel")}>
      {/* Category specific */}
      {e.category === "sleep" && (
        <>
          <Seg value={e.subtype} onChange={(v) => set({ subtype: v })} label={t("type")}
            options={[{ value: "nap", label: t("nap") }, { value: "night", label: t("night") }]} />
          <Field label={t("location")}>
            <div className="chips">
              {LOCATIONS.map((l) => (
                <button key={l} className="chip" style={{ ["--cat" as string]: "var(--c-sleep)" }} aria-pressed={d.location === l}
                  onClick={() => setData({ location: d.location === l ? undefined : l })}>{t(l)}</button>
              ))}
            </div>
          </Field>
        </>
      )}

      {e.category === "feeding" && (
        <>
          <Seg value={e.subtype} onChange={switchFeedType} label={t("feeding")}
            options={[{ value: "breastfeeding", label: t("breastfeeding") }, { value: "bottle", label: t("bottle") }, { value: "solids", label: t("solids") }]} />

          {e.subtype === "breastfeeding" && (() => {
            const s = sideSeconds(e, now);
            const tap = (side: Side) => liveUpdate(withSide(e, d.active_side === side ? null : side, Date.now()));
            return (
              <>
                {lastBreast?.data.last_side && (
                  <div className="t-sub" style={{ textAlign: "center" }}>
                    {t("lastEndedOn", { side: t(lastBreast.data.last_side === "L" ? "left" : "right"), next: t(lastSideHint() === "L" ? "left" : "right") })}
                  </div>
                )}
                {running ? (
                  <>
                    {/* L/R stay physical (mother's left/right) even in Hebrew */}
                    <div className="sides">
                      {(["L", "R"] as Side[]).map((side) => (
                        <button key={side} className={`side press ${d.active_side === side ? "on" : ""}`} onClick={() => tap(side)}>
                          <span className="letter">{side}</span>
                          <span className="num t-headline">{fmtDuration(s[side] * 1000, lang, true)}</span>
                          <span className="t-caption" style={{ color: "inherit" }}>{d.active_side === side ? t("pause") : t(side === "L" ? "left" : "right")}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ textAlign: "center" }} className="t-sub">
                      {t("total")} <b className="num">{fmtDuration((s.L + s.R) * 1000, lang, true)}</b>
                      {d.active_side && (
                        <button className="link" onClick={() => liveUpdate(withSide(e, null, Date.now()))}><Pause size={14} /> {t("pause")}</button>
                      )}
                    </div>
                  </>
                ) : (
                  <Group>
                    {(["L", "R"] as Side[]).map((side) => (
                      <Row key={side} label={`${t(side === "L" ? "left" : "right")} (${t("minutes")})`}>
                        <input type="number" inputMode="numeric" min={0} value={Math.round((d.sides?.[side] ?? 0) / 60) || ""} placeholder="0"
                          onChange={(ev) => setData({ sides: { L: d.sides?.L ?? 0, R: d.sides?.R ?? 0, [side]: Number(ev.target.value) * 60 } })} />
                      </Row>
                    ))}
                  </Group>
                )}
                <Group>
                  <Row label={`${t("amountMl")} · ${t("optional")}`}>
                    <input type="number" inputMode="numeric" min={0} value={d.amount_ml ?? ""} placeholder="—"
                      onChange={(ev) => setData({ amount_ml: ev.target.value ? Number(ev.target.value) : undefined })} />
                  </Row>
                </Group>
              </>
            );
          })()}

          {e.subtype === "bottle" && (
            <>
              <Seg value={d.milk_type ?? "formula"} onChange={(v) => setData({ milk_type: v })}
                options={[{ value: "formula", label: t("formula") }, { value: "breastmilk", label: t("breastmilk") }]} />
              <div className="card">
                <div className="stepper">
                  <button aria-label="-10 ml" onClick={() => setData({ amount_ml: Math.max(0, (d.amount_ml ?? 0) - 10) })}><Minus /></button>
                  <span className="big num">{d.amount_ml ?? 0}<span className="t-title3 muted"> ml</span></span>
                  <button aria-label="+10 ml" onClick={() => setData({ amount_ml: (d.amount_ml ?? 0) + 10 })}><Plus /></button>
                </div>
                <div className="chips" style={{ justifyContent: "center" }}>
                  {[60, 90, 120, 150, 180].map((ml) => (
                    <button key={ml} className="chip num" style={{ ["--cat" as string]: "var(--c-feeding)" }} aria-pressed={d.amount_ml === ml}
                      onClick={() => setData({ amount_ml: ml })}>{ml}</button>
                  ))}
                </div>
              </div>
              {d.milk_type !== "breastmilk" && (
                <Group>
                  <Row label={t("brand")}>
                    <input type="text" value={d.formula_brand ?? ""} placeholder={t("optional")} onChange={(ev) => setData({ formula_brand: ev.target.value })} />
                  </Row>
                </Group>
              )}
            </>
          )}

          {e.subtype === "solids" && (
            <>
              <Seg value={d.meal ?? "snack"} onChange={(v) => setData({ meal: v })}
                options={(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => ({ value: m, label: t(m) }))} />
              <Field label={t("whatDidEat", { name: baby?.name ?? "" })}>
                <div className="group">
                  <div className="row">
                    <textarea rows={3} value={d.description ?? ""} placeholder={t("whatDidEatPh")} onChange={(ev) => setData({ description: ev.target.value })} />
                  </div>
                </div>
              </Field>
              {photoField}
              <Field label={t("amountEaten")}>
                <Seg value={d.amount_eaten ?? ("" as never)} onChange={(v) => setData({ amount_eaten: v })}
                  options={(["taste", "some", "most", "all"] as const).map((m) => ({ value: m, label: t(m) }))} />
              </Field>
              <Group>
                <Row label={t("firstTime")}><Switch checked={!!d.first_time} onChange={(v) => setData({ first_time: v })} label={t("firstTime")} /></Row>
                <Row label={t("reaction")}>
                  <select value={d.reaction ?? "none"} onChange={(ev) => setData({ reaction: ev.target.value as EventData["reaction"] })}>
                    {(["none", "liked", "disliked", "rash", "upset", "other"] as const).map((r) => <option key={r} value={r}>{t(r)}</option>)}
                  </select>
                </Row>
              </Group>
            </>
          )}
        </>
      )}

      {e.category === "diaper" && (
        <>
          <div className="big-options" style={{ ["--cat" as string]: "var(--c-diaper)" }}>
            {(["wet", "dirty", "mixed"] as const).map((k) => (
              <button key={k} className="press" aria-pressed={e.subtype === k} onClick={() => set({ subtype: k })}>
                <span style={{ fontSize: 28 }}>{k === "wet" ? "💧" : k === "dirty" ? "💩" : "💧💩"}</span>{t(k)}
              </button>
            ))}
          </div>
          <Group>
            <Row label={t("dry")}><Switch checked={e.subtype === "dry"} onChange={(v) => set({ subtype: v ? "dry" : "wet" })} label={t("dry")} /></Row>
          </Group>
          {(e.subtype === "dirty" || e.subtype === "mixed") && (
            <Field label={t("texture")}>
              <div className="chips">
                {TEXTURES.map((x) => (
                  <button key={x} className="chip" style={{ ["--cat" as string]: "var(--c-diaper)" }} aria-pressed={d.texture === x}
                    onClick={() => setData({ texture: d.texture === x ? undefined : x })}>{t(`tx_${x}` as TKey)}</button>
                ))}
              </div>
            </Field>
          )}
          {(e.subtype === "dirty" || e.subtype === "mixed") && (
            <Field label={t("color")}>
              <div className="swatches">
                {DIAPER_COLORS.map((c) => (
                  <button key={c} style={{ background: c }} aria-pressed={d.color === c} aria-label={c}
                    onClick={() => setData({ color: d.color === c ? undefined : c })} />
                ))}
              </div>
            </Field>
          )}
          {photoField}
        </>
      )}

      {e.category === "pumping" && (
        <>
          <Group>
            {(["left_ml", "right_ml"] as const).map((k) => (
              <Row key={k} label={`${t(k === "left_ml" ? "left" : "right")} (ml)`}>
                <input type="number" inputMode="numeric" min={0} value={d[k] || ""} placeholder="0" onChange={(ev) => setData({ [k]: Number(ev.target.value) })} />
              </Row>
            ))}
            <Row label={t("toStash")}><Switch checked={!!d.to_stash} onChange={(v) => setData({ to_stash: v })} label={t("toStash")} /></Row>
          </Group>
        </>
      )}

      {e.category === "health" && (
        <>
          <Seg value={e.subtype} onChange={(v) => set({ subtype: v, data: v === "medicine" ? { unit: "ml" } : v === "temperature" ? { method: "armpit" } : {} })}
            options={(["medicine", "temperature", "growth"] as const).map((m) => ({ value: m, label: t(m) }))} />
          {e.subtype === "medicine" && (
            <>
              <Group>
                <Row label={t("medName")}><input type="text" value={d.name ?? ""} placeholder="Paracetamol" onChange={(ev) => setData({ name: ev.target.value })} /></Row>
                <Row label={t("dose")}><input type="number" inputMode="decimal" min={0} step="0.1" value={d.dose ?? ""} onChange={(ev) => setData({ dose: ev.target.value ? Number(ev.target.value) : undefined })} /></Row>
                <Row label={t("unit")}>
                  <select value={d.unit ?? "ml"} onChange={(ev) => setData({ unit: ev.target.value })}>
                    {["ml", "mg", "drops", "tablet"].map((u) => <option key={u}>{u}</option>)}
                  </select>
                </Row>
              </Group>
              <div className="group-foot">{t("doseFooter")}</div>
            </>
          )}
          {e.subtype === "temperature" && (
            <>
              <div className="card">
                <div className="stepper">
                  <button aria-label="-0.1" onClick={() => setData({ celsius: Math.round(((d.celsius ?? 37) - 0.1) * 10) / 10 })}><Minus /></button>
                  <span className="big num" style={{ color: (d.celsius ?? 37) >= 38 ? "var(--amber)" : undefined }}>{(d.celsius ?? 37).toFixed(1)}<span className="t-title3 muted"> °C</span></span>
                  <button aria-label="+0.1" onClick={() => setData({ celsius: Math.round(((d.celsius ?? 37) + 0.1) * 10) / 10 })}><Plus /></button>
                </div>
              </div>
              <Seg value={d.method ?? "armpit"} onChange={(v) => setData({ method: v })}
                options={(["armpit", "ear", "forehead", "rectal"] as const).map((m) => ({ value: m, label: t(m) }))} />
              {(d.celsius ?? 37) >= 38 && <div className="banner">{t("feverNote")}</div>}
            </>
          )}
          {e.subtype === "growth" && (
            <Group>
              {([["weight_kg", "weightKg"], ["length_cm", "lengthCm"], ["head_cm", "headCm"]] as const).map(([k, l]) => (
                <Row key={k} label={t(l)}>
                  <input type="number" inputMode="decimal" min={0} step="0.1" value={d[k] ?? ""} onChange={(ev) => setData({ [k]: ev.target.value ? Number(ev.target.value) : undefined })} />
                </Row>
              ))}
            </Group>
          )}
        </>
      )}

      {/* Time */}
      <Group>
        <Row label={hasDuration(e) ? t("start") : t("time")}>
          <input type="datetime-local" value={toLocalInput(e.started_at)}
            onChange={(ev) => ev.target.value && set({ started_at: fromLocalInput(ev.target.value), ...(!hasDuration(e) && { ended_at: fromLocalInput(ev.target.value) }) })} />
        </Row>
        {hasDuration(e) && (running ? (
          <div className="row">
            <span className="grow">{t("stillRunningLabel")}</span>
            <span className="num muted">{fmtDuration(now - new Date(e.started_at).getTime(), lang, true)}</span>
            <button className="stop-btn press" aria-label={t("stop")} onClick={stopNow}><Square size={14} fill="currentColor" /></button>
          </div>
        ) : (
          <Row label={t("end")}>
            <input type="datetime-local" value={toLocalInput(e.ended_at!)} onChange={(ev) => ev.target.value && set({ ended_at: fromLocalInput(ev.target.value) })} />
          </Row>
        ))}
      </Group>

      <Group>
        <div className="row">
          <textarea rows={2} value={e.note ?? ""} placeholder={t("notePh")} onChange={(ev) => set({ note: ev.target.value || null })} />
        </div>
      </Group>

      {!isNew && (
        <button className="btn danger block" onClick={() => { deleteEvent(initial); onClose(); }}>{t("deleteEvent")}</button>
      )}
    </Sheet>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="group">{children}</div>;
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="row">
      <span className="grow">{label}</span>
      {children}
    </label>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="group-label">{label}</div>
      {children}
    </div>
  );
}
