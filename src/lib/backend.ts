import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Baby, BabyEvent, Family, Member, Profile } from "../types";

export interface User {
  id: string;
  email: string | null;
}

/** Everything the UI needs from storage. Two implementations: on-device and Supabase. */
export interface Backend {
  mode: "local" | "supabase";
  getUser(): Promise<User | null>;
  onAuthChange(cb: () => void): () => void;
  sendLoginEmail(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<void>;
  /** Returns false when Supabase still wants the email confirmed before signing in. */
  signUp(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
  getProfile(): Promise<Profile | null>;
  saveProfile(p: Profile): Promise<void>;
  getFamily(): Promise<Family | null>;
  createFamily(name: string): Promise<Family>;
  joinFamily(code: string): Promise<Family>;
  getMembers(familyId: string): Promise<Member[]>;
  listBabies(familyId: string): Promise<Baby[]>;
  saveBaby(b: Baby): Promise<void>;
  listEvents(babyId: string, sinceISO: string): Promise<BabyEvent[]>;
  saveEvent(e: BabyEvent): Promise<void>;
  /** Bulk upsert, used by history import. */
  saveEvents(list: BabyEvent[]): Promise<void>;
  /** Calls back whenever family data changes elsewhere (other parent, other tab). */
  subscribe(familyId: string, cb: () => void): () => void;
  uploadPhoto(familyId: string, blob: Blob): Promise<string>;
  photoUrl(path: string): Promise<string>;
}

export const uuid = () => crypto.randomUUID();

/* ------------------------------------------------------------------ */
/* On-device storage                                                   */
/* ------------------------------------------------------------------ */

const LS = "lulu:v1:";
const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(LS + k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => localStorage.setItem(LS + k, JSON.stringify(v));

const LOCAL_USER: User = { id: "00000000-0000-4000-8000-000000000001", email: null };

function localBackend(): Backend {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith(LS)) notify();
  });
  return {
    mode: "local",
    async getUser() {
      return LOCAL_USER;
    },
    onAuthChange() {
      return () => {};
    },
    async sendLoginEmail() {},
    async verifyCode() {},
    async signInWithPassword() {},
    async signUp() {
      return true;
    },
    async signOut() {},
    async getProfile() {
      return read<Profile | null>("profile", null);
    },
    async saveProfile(p) {
      write("profile", p);
    },
    async getFamily() {
      return read<Family | null>("family", null);
    },
    async createFamily(name) {
      const f: Family = { id: uuid(), name, invite_code: "" };
      write("family", f);
      return f;
    },
    async joinFamily() {
      throw new Error("Joining a family needs cloud sync.");
    },
    async getMembers() {
      const p = read<Profile | null>("profile", null);
      return p ? [{ user_id: p.id, display_name: p.display_name }] : [];
    },
    async listBabies(familyId) {
      return read<Baby[]>("babies", []).filter((b) => b.family_id === familyId);
    },
    async saveBaby(b) {
      const all = read<Baby[]>("babies", []).filter((x) => x.id !== b.id);
      write("babies", [...all, b]);
    },
    async listEvents(babyId, sinceISO) {
      return read<BabyEvent[]>("events", []).filter(
        (e) => e.baby_id === babyId && !e.deleted_at && (e.started_at >= sinceISO || !e.ended_at || e.ended_at >= sinceISO),
      );
    },
    async saveEvent(e) {
      const all = read<BabyEvent[]>("events", []).filter((x) => x.id !== e.id);
      write("events", [...all, e]);
    },
    async saveEvents(list) {
      const ids = new Set(list.map((e) => e.id));
      write("events", [...read<BabyEvent[]>("events", []).filter((x) => !ids.has(x.id)), ...list]);
    },
    subscribe(_familyId, cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async uploadPhoto(_familyId, blob) {
      return await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
    },
    async photoUrl(path) {
      return path;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

function supabaseBackend(sb: SupabaseClient): Backend {
  const uid = async () => (await sb.auth.getUser()).data.user?.id ?? null;
  const must = <T,>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  const signed = new Map<string, { url: string; exp: number }>();

  return {
    mode: "supabase",
    async getUser() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? null } : null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },
    async sendLoginEmail(email) {
      const redirect = window.location.origin + window.location.pathname;
      must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } }));
    },
    async verifyCode(email, code) {
      must(await sb.auth.verifyOtp({ email, token: code, type: "email" }));
    },
    async signInWithPassword(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signUp(email, password) {
      const redirect = window.location.origin + window.location.pathname;
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
      if (error) throw new Error(error.message);
      return !!data.session;
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async getProfile() {
      const id = await uid();
      if (!id) return null;
      return must(await sb.from("profiles").select("id,display_name,language,time_format").eq("id", id).maybeSingle()) as Profile | null;
    },
    async saveProfile(p) {
      must(await sb.from("profiles").upsert(p));
    },
    async getFamily() {
      const id = await uid();
      if (!id) return null;
      const row = must(
        await sb.from("family_members").select("families(id,name,invite_code)").eq("user_id", id).order("joined_at").limit(1).maybeSingle(),
      ) as { families: Family } | null;
      return row?.families ?? null;
    },
    async createFamily(name) {
      return must(await sb.rpc("create_family", { fname: name }).single()) as Family;
    },
    async joinFamily(code) {
      return must(await sb.rpc("join_family", { code: code.trim().toUpperCase() }).single()) as Family;
    },
    async getMembers(familyId) {
      // Two plain queries: family_members has no foreign key to profiles, so it can't be embedded.
      const rows = must(await sb.from("family_members").select("user_id").eq("family_id", familyId)) as { user_id: string }[];
      const ids = rows.map((r) => r.user_id);
      const profiles = ids.length
        ? (must(await sb.from("profiles").select("id,display_name").in("id", ids)) as { id: string; display_name: string }[])
        : [];
      return ids.map((id) => ({ user_id: id, display_name: profiles.find((p) => p.id === id)?.display_name ?? "" }));
    },
    async listBabies(familyId) {
      return must(await sb.from("babies").select("id,family_id,name,birth_date,sex").eq("family_id", familyId).order("created_at")) as Baby[];
    },
    async saveBaby(b) {
      must(await sb.from("babies").upsert(b));
    },
    async listEvents(babyId, sinceISO) {
      return must(
        await sb
          .from("events")
          .select("*")
          .eq("baby_id", babyId)
          .is("deleted_at", null)
          .or(`started_at.gte.${sinceISO},ended_at.is.null,ended_at.gte.${sinceISO}`)
          .order("started_at", { ascending: false }),
      ) as BabyEvent[];
    },
    async saveEvent(e) {
      must(await sb.from("events").upsert(e));
    },
    async saveEvents(list) {
      for (let i = 0; i < list.length; i += 500) must(await sb.from("events").upsert(list.slice(i, i + 500)));
    },
    subscribe(familyId, cb) {
      const ch = sb
        .channel("family-" + familyId)
        .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `family_id=eq.${familyId}` }, cb)
        .on("postgres_changes", { event: "*", schema: "public", table: "babies", filter: `family_id=eq.${familyId}` }, cb)
        .subscribe();
      return () => {
        sb.removeChannel(ch);
      };
    },
    async uploadPhoto(familyId, blob) {
      const path = `${familyId}/${uuid()}.jpg`;
      must(await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" }));
      return path;
    },
    async photoUrl(path) {
      const hit = signed.get(path);
      if (hit && hit.exp > Date.now()) return hit.url;
      const signedUrl = must(await sb.storage.from("photos").createSignedUrl(path, 3600))?.signedUrl ?? "";
      signed.set(path, { url: signedUrl, exp: Date.now() + 50 * 60_000 });
      return signedUrl;
    },
  };
}

/**
 * Accepts the Project URL however it was pasted: with /rest/v1/, a trailing slash,
 * spaces, or even the dashboard link — supabase-js needs just https://<ref>.supabase.co.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  const ref = v.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i)?.[1];
  if (ref) return `https://${ref}.supabase.co`;
  try {
    return new URL(v.includes("://") ? v : `https://${v}`).origin;
  } catch {
    return v;
  }
}

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const backend: Backend =
  url && key ? supabaseBackend(createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } })) : localBackend();
