import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { backend, uuid, type User } from "../lib/backend";
import { loadSettings, storeSettings, type DeviceSettings } from "../lib/settings";
import { translate, type T } from "../i18n";
import { withSide } from "../lib/feeding";
import { DAY, startOfDay } from "../lib/time";
import type { Baby, BabyEvent, Category, EventData, Family, Lang, Member, Profile, Subtype } from "../types";

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  secondary?: { label: string; run: () => void };
}

export type SheetState =
  | { kind: "event"; event: BabyEvent; isNew: boolean }
  | { kind: "baby"; baby: Baby | null }
  | { kind: "babies" }
  | null;

type Phase = "loading" | "login" | "onboarding" | "ready";

interface Ctx {
  phase: Phase;
  user: User | null;
  profile: Profile | null;
  family: Family | null;
  members: Member[];
  babies: Baby[];
  baby: Baby | null;
  events: BabyEvent[];
  settings: DeviceSettings;
  lang: Lang;
  t: T;
  setSettings: (patch: Partial<DeviceSettings>) => void;
  refresh: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  saveBaby: (b: Baby) => Promise<void>;
  newEvent: (category: Category, subtype: Subtype, data?: EventData) => BabyEvent;
  saveEvent: (e: BabyEvent) => Promise<void>;
  startTimer: (category: Category, subtype: Subtype, data?: EventData) => Promise<BabyEvent>;
  stopEvent: (e: BabyEvent) => Promise<void>;
  deleteEvent: (e: BabyEvent) => Promise<void>;
  toast: Toast | null;
  showToast: (t: Omit<Toast, "id">) => void;
  dismissToast: () => void;
  sheet: SheetState;
  openSheet: (s: SheetState) => void;
  memberName: (userId: string | null) => string;
}

const AppCtx = createContext<Ctx | null>(null);

export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

/** History window kept in memory for the active baby. */
const WINDOW_DAYS = 35;

export function AppProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [settings, setSettingsState] = useState<DeviceSettings>(loadSettings);
  const [toast, setToast] = useState<Toast | null>(null);
  const [sheet, openSheet] = useState<SheetState>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const membersRef = useRef<Member[]>([]);
  membersRef.current = members;

  const lang: Lang = profile?.language ?? (navigator.language.startsWith("he") ? "he" : "en");
  const t = useCallback<T>((k, v) => translate(lang, k, v), [lang]);

  const setSettings = useCallback((patch: Partial<DeviceSettings>) => {
    setSettingsState((s) => {
      const next = { ...s, ...patch };
      storeSettings(next);
      return next;
    });
  }, []);

  const baby = babies.find((b) => b.id === settings.activeBabyId) ?? babies[0] ?? null;

  const showToast = useCallback((tt: Omit<Toast, "id">) => setToast({ ...tt, id: Date.now() }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  /** Loads who-am-I, family and babies, and decides which screen to show. */
  const loadAccount = useCallback(async () => {
    try {
      const u = await backend.getUser();
      setUser(u);
      if (!u) return setPhase("login");
      const [p, f] = await Promise.all([backend.getProfile(), backend.getFamily()]);
      setProfile(p);
      setFamily(f);
      if (!p || !f) return setPhase("onboarding");
      const [bs, ms] = await Promise.all([backend.listBabies(f.id), backend.getMembers(f.id)]);
      setBabies(bs);
      setMembers(ms);
      setPhase(bs.length ? "ready" : "onboarding");
    } catch (err) {
      console.error(err);
      setPhase((ph) => (ph === "loading" ? "login" : ph));
    }
  }, []);

  useEffect(() => {
    loadAccount();
    return backend.onAuthChange(() => loadAccount());
  }, [loadAccount]);

  const loadEvents = useCallback(async () => {
    if (!baby || !user) return;
    const since = new Date(startOfDay().getTime() - WINDOW_DAYS * DAY).toISOString();
    try {
      const list = await backend.listEvents(baby.id, since);
      list.sort((a, b) => b.started_at.localeCompare(a.started_at));
      // Tell this parent when the other one logs something.
      if (seenIds.current) {
        const fresh = list.find((e) => !seenIds.current!.has(e.id) && e.logged_by && e.logged_by !== user.id);
        if (fresh) {
          const who = membersRef.current.find((m) => m.user_id === fresh.logged_by)?.display_name || "Partner";
          const what = `${translate(lang, fresh.category)} · ${translate(lang, fresh.subtype)}`;
          showToast({ text: translate(lang, "partnerLogged", { name: who, what }) });
        }
      }
      seenIds.current = new Set(list.map((e) => e.id));
      setEvents(list);
    } catch (err) {
      console.error(err);
      showToast({ text: translate(lang, "couldntSync") });
    }
  }, [baby?.id, user?.id, lang, showToast]);

  useEffect(() => {
    seenIds.current = null;
    setEvents([]);
    loadEvents();
  }, [baby?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const familyId = family?.id;
  useEffect(() => {
    if (!familyId) return;
    const off = backend.subscribe(familyId, () => {
      loadEvents();
      backend.listBabies(familyId).then(setBabies).catch(() => {});
    });
    // Catch up after the phone wakes or the app comes back to the foreground.
    const onVis = () => document.visibilityState === "visible" && loadEvents();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      off();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [familyId, loadEvents]);

  const refresh = useCallback(async () => {
    await loadAccount();
    await loadEvents();
  }, [loadAccount, loadEvents]);

  const saveProfile = useCallback(async (p: Profile) => {
    setProfile(p);
    await backend.saveProfile(p);
  }, []);

  const saveBaby = useCallback(
    async (b: Baby) => {
      setBabies((bs) => [...bs.filter((x) => x.id !== b.id), b]);
      setSettings({ activeBabyId: b.id });
      await backend.saveBaby(b);
    },
    [setSettings],
  );

  const newEvent = useCallback(
    (category: Category, subtype: Subtype, data: EventData = {}): BabyEvent => {
      const now = new Date().toISOString();
      return {
        id: uuid(),
        baby_id: baby!.id,
        family_id: family!.id,
        category,
        subtype,
        started_at: now,
        ended_at: now,
        logged_by: user?.id ?? null,
        note: null,
        data,
        photo_path: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
    },
    [baby, family, user],
  );

  /** Optimistic save: the UI updates instantly, storage catches up. */
  const saveEvent = useCallback(
    async (e: BabyEvent) => {
      const next = { ...e, updated_at: new Date().toISOString() };
      seenIds.current?.add(next.id);
      setEvents((list) => {
        const rest = list.filter((x) => x.id !== next.id);
        if (next.deleted_at) return rest;
        return [next, ...rest].sort((a, b) => b.started_at.localeCompare(a.started_at));
      });
      try {
        await backend.saveEvent(next);
      } catch (err) {
        console.error(err);
        showToast({ text: translate(lang, "couldntSync") });
      }
    },
    [lang, showToast],
  );

  const startTimer = useCallback(
    async (category: Category, subtype: Subtype, data: EventData = {}) => {
      // One running timer per category per baby: reuse it instead of duplicating.
      const running = events.find((e) => e.category === category && !e.ended_at);
      if (running) return running;
      const e = { ...newEvent(category, subtype, data), ended_at: null };
      await saveEvent(e);
      return e;
    },
    [events, newEvent, saveEvent],
  );

  const stopEvent = useCallback(
    async (e: BabyEvent) => {
      const now = Date.now();
      let done: BabyEvent = { ...e, ended_at: new Date(now).toISOString() };
      if (e.subtype === "breastfeeding") done = { ...withSide(done, null, now), ended_at: done.ended_at };
      await saveEvent(done);
      if (navigator.vibrate) navigator.vibrate(10);
      showToast({
        text: `${translate(lang, "logged")} · ${translate(lang, e.category)}`,
        action: { label: translate(lang, "undo"), run: () => saveEvent({ ...e }) },
        secondary: { label: translate(lang, "details"), run: () => openSheet({ kind: "event", event: done, isNew: false }) },
      });
    },
    [lang, saveEvent, showToast],
  );

  const deleteEvent = useCallback(
    async (e: BabyEvent) => {
      await saveEvent({ ...e, deleted_at: new Date().toISOString() });
      showToast({
        text: translate(lang, "deleted"),
        action: { label: translate(lang, "undo"), run: () => saveEvent({ ...e, deleted_at: null }) },
      });
    },
    [lang, saveEvent, showToast],
  );

  const memberName = useCallback(
    (id: string | null) => members.find((m) => m.user_id === id)?.display_name || profile?.display_name || "",
    [members, profile],
  );

  // Language direction and theme on <html>.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    const apply = () => {
      const h = new Date().getHours();
      const night = settings.nightMode && (h >= 20 || h < 7);
      const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = night || settings.appearance === "dark" || (settings.appearance === "system" && sysDark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.dataset.night = night ? "1" : "0";
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    const iv = setInterval(apply, 60_000);
    return () => {
      mq.removeEventListener("change", apply);
      clearInterval(iv);
    };
  }, [settings.appearance, settings.nightMode]);

  const value = useMemo<Ctx>(
    () => ({
      phase, user, profile, family, members, babies, baby, events, settings, lang, t,
      setSettings, refresh, saveProfile, saveBaby, newEvent, saveEvent, startTimer, stopEvent, deleteEvent,
      toast, showToast, dismissToast, sheet, openSheet, memberName,
    }),
    [phase, user, profile, family, members, babies, baby, events, settings, lang, t, setSettings, refresh, saveProfile,
      saveBaby, newEvent, saveEvent, startTimer, stopEvent, deleteEvent, toast, showToast, dismissToast, sheet, memberName],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Re-renders every `ms` so live timers tick. Elapsed time is always derived from started_at. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(iv);
  }, [ms]);
  return now;
}
