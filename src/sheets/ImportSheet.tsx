import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { useApp } from "../state/AppContext";
import { Seg, Sheet } from "../components/Sheet";
import { CATEGORY_ORDER, catVar } from "../lib/categories";
import { eventTitle } from "../lib/summary";
import { fmtClock, fmtDate } from "../lib/time";
import {
  FIELDS, classify, convertRow, detectDayFirst, guessMapping, readFiles, stableId,
  type Force, type ImportedEvent, type Mapping, type Table,
} from "../lib/importer";
import type { BabyEvent, Category } from "../types";
import type { TKey } from "../i18n";

interface TableState {
  table: Table;
  mapping: Mapping;
  force: Force;
}

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { t, lang, baby, family, user, profile, importEvents, showToast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tables, setTables] = useState<TableState[]>([]);
  const [dayFirst, setDayFirst] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    setBusy(true);
    try {
      const read = await readFiles([...files]);
      if (!read.length) setErr(t("noRows"));
      const states = read.map((table) => {
        const mapping = guessMapping(table.headers);
        // No type column but the file name says what it is (e.g. "sleep.csv") → use that.
        const fromName = mapping.type === undefined ? classify(table.name)?.category : undefined;
        return { table, mapping, force: (fromName ?? "auto") as Force };
      });
      const dateCol = states.flatMap(({ table, mapping }) => table.rows.slice(0, 300).map((r) => r[mapping.start ?? mapping.date ?? -1] ?? null));
      setDayFirst(detectDayFirst(dateCol));
      setTables(states);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const result = useMemo(() => {
    const events: ImportedEvent[] = [];
    let skipped = 0;
    const unknown = new Set<string>();
    for (const { table, mapping, force } of tables) {
      for (const row of table.rows) {
        const e = convertRow(table, row, mapping, { dayFirst, force });
        if (e) events.push(e);
        else {
          skipped++;
          const typ = mapping.type !== undefined ? String(row[mapping.type] ?? "").trim() : "";
          if (typ && unknown.size < 6) unknown.add(typ);
        }
      }
    }
    events.sort((a, b) => b.started_at.localeCompare(a.started_at));
    const counts = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, events.filter((e) => e.category === c).length])) as Record<Category, number>;
    return { events, skipped, unknown: [...unknown], counts };
  }, [tables, dayFirst]);

  async function runImport() {
    if (!baby || !family) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const list: BabyEvent[] = await Promise.all(
        result.events.map(async (e) => ({
          ...e,
          id: await stableId(baby.id, e),
          baby_id: baby.id,
          family_id: family.id,
          logged_by: user?.id ?? null,
          photo_path: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        })),
      );
      await importEvents(list);
      showToast({ text: t("imported", { n: list.length }) });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const update = (i: number, patch: Partial<TableState>) => setTables((ts) => ts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const sample = result.events.slice(0, 6);

  return (
    <Sheet title={t("importTitle")} onClose={onClose} cancelLabel={t("cancel")}>
      <p className="t-sub" style={{ margin: 0 }}>{t("importIntro")}</p>
      <input ref={fileRef} type="file" hidden multiple
        accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      <button className="btn soft block press" disabled={busy} onClick={() => fileRef.current?.click()}>
        <FileSpreadsheet size={20} />{t("chooseFiles")}
      </button>
      {err && <p className="t-foot" style={{ margin: 0, color: "var(--danger)" }}>{err}</p>}

      {tables.length > 0 && (
        <>
          <div>
            <div className="group-label">{t("dateOrder")}</div>
            <Seg value={dayFirst ? "d" : "m"} onChange={(v) => setDayFirst(v === "d")}
              options={[{ value: "d", label: `${t("dayFirst")} (17/10)` }, { value: "m", label: `${t("monthFirst")} (10/17)` }]} />
          </div>

          {tables.map(({ table, mapping, force }, i) => (
            <section key={i}>
              <div className="group-label">{table.name} · {t("rowsFound", { n: table.rows.length })}</div>
              <div className="group">
                <label className="row">
                  <span className="grow">{t("treatAs")}</span>
                  <select value={force} onChange={(e) => update(i, { force: e.target.value as Force })}>
                    <option value="auto">{t("autoDetect")}</option>
                    {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{t(c)}</option>)}
                  </select>
                </label>
                {FIELDS.map((f) => (
                  <label key={f} className="row">
                    <span className="grow">{t(`f_${f}` as TKey)}</span>
                    <select value={mapping[f] ?? -1} style={{ maxWidth: "55%" }} onChange={(e) => {
                      const v = Number(e.target.value);
                      const next = { ...mapping };
                      if (v < 0) delete next[f];
                      else next[f] = v;
                      update(i, { mapping: next });
                    }}>
                      <option value={-1}>{t("notMapped")}</option>
                      {table.headers.map((h, j) => <option key={j} value={j}>{h || `#${j + 1}`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </section>
          ))}

          <section>
            <div className="group-label">{t("willImport")}</div>
            <div className="chips">
              {CATEGORY_ORDER.filter((c) => result.counts[c]).map((c) => (
                <span key={c} className="chip" style={{ ["--cat" as string]: catVar(c) }}><span className="dot" />{t(c)} <b>{result.counts[c]}</b></span>
              ))}
            </div>
            {result.skipped > 0 && <div className="group-foot">{t("skipped", { n: result.skipped })}</div>}
            {result.unknown.length > 0 && <div className="group-foot">{t("unknownTypes", { list: result.unknown.join(", ") })}</div>}
          </section>

          {sample.length > 0 && (
            <section>
              <div className="group-label">{t("preview")}</div>
              <div className="group">
                {sample.map((e, i) => (
                  <div key={i} className="row" style={{ ["--cat" as string]: catVar(e.category) }}>
                    <span className="dot" style={{ width: 10, height: 10, borderRadius: 5, background: "var(--cat)", flex: "none" }} />
                    <div className="grow">
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {eventTitle({ ...e, id: "", baby_id: "", family_id: "", logged_by: null, photo_path: null, created_at: "", updated_at: "", deleted_at: null }, t, lang)}
                      </div>
                      <div className="t-foot num">
                        {fmtDate(new Date(e.started_at), lang)} · {fmtClock(e.started_at, profile?.time_format)}
                        {e.ended_at !== e.started_at && ` – ${fmtClock(e.ended_at, profile?.time_format)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button className="btn block press" disabled={busy || !result.events.length} onClick={runImport}>
            {busy ? t("importing") : t("importN", { n: result.events.length, name: baby?.name ?? "" })}
          </button>
        </>
      )}
    </Sheet>
  );
}
