import { useState } from "react";
import { Moon, Share } from "lucide-react";
import { useApp } from "../state/AppContext";
import { BabyForm } from "../sheets/BabySheets";
import { Seg } from "../components/Sheet";
import { backend, uuid } from "../lib/backend";
import type { Baby, Lang } from "../types";

const EMAIL_KEY = "lulu:loginEmail";

export function Login() {
  const { t, authError, user, refresh } = useApp();
  const [mode, setMode] = useState<"signin" | "signup" | "email">("signin");
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setErr("");
    setInfo("");
    setBusy(true);
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const mail = email.trim();
  const remember = () => localStorage.setItem(EMAIL_KEY, mail);
  const send = () => run(async () => { await backend.sendLoginEmail(mail); remember(); setSent(true); });
  const shownError = err || authError;
  const okEmail = mail.includes("@");

  if (user) {
    // Signed in, but loading the family failed: say so instead of asking to sign in again.
    return (
      <div className="onb">
        <Moon size={44} color="var(--c-sleep)" />
        <p className="t-callout" style={{ margin: 0 }}>{t("signedInAs", { email: user.email ?? "" })}</p>
        {shownError && <p className="t-foot" style={{ margin: 0, color: "var(--danger)" }}>{shownError}</p>}
        <div className="spacer" />
        <button className="btn block press" onClick={() => refresh()}>{t("tryAgain")}</button>
        <button className="btn plain block press" onClick={() => backend.signOut()}>{t("signOut")}</button>
      </div>
    );
  }

  return (
    <div className="onb">
      <Moon size={44} color="var(--c-sleep)" />
      <div>
        <h1 className="t-large" style={{ margin: "0 0 8px" }}>{t("welcome")}</h1>
        <p className="t-callout muted" style={{ margin: 0 }}>{t("welcomeSub")}</p>
      </div>

      {mode !== "email" && (
        <Seg value={mode} onChange={(v) => { setMode(v); setErr(""); setInfo(""); }}
          options={[{ value: "signin", label: t("signIn") }, { value: "signup", label: t("createAccount") }]} />
      )}

      <div className="group">
        <label className="row"><span>{t("email")}</span>
          <input type="email" autoComplete="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== "email" && (
          <label className="row"><span>{t("password")}</span>
            <input type="password" value={password} placeholder={mode === "signup" ? t("passwordHint") : "••••••"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {mode === "email" && sent && (
          <label className="row"><span>{t("code")}</span>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} placeholder="123456"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </label>
        )}
      </div>

      {mode === "email" && sent && <p className="t-foot" style={{ margin: 0 }}>{t("checkEmail")}</p>}
      {info && <p className="t-foot" style={{ margin: 0 }}>{info}</p>}
      {shownError && <p className="t-foot" style={{ margin: 0, color: "var(--danger)" }}>{shownError}</p>}
      <div className="spacer" />

      {mode === "signin" && (
        <button className="btn block press" disabled={busy || !okEmail || !password}
          onClick={() => run(async () => { await backend.signInWithPassword(mail, password); remember(); })}>{t("signIn")}</button>
      )}
      {mode === "signup" && (
        <button className="btn block press" disabled={busy || !okEmail || password.length < 6}
          onClick={() => run(async () => {
            const signedIn = await backend.signUp(mail, password);
            remember();
            if (!signedIn) setInfo(t("confirmEmailFirst"));
          })}>{t("createAccount")}</button>
      )}
      {mode === "email" && (sent ? (
        <>
          <button className="btn block press" disabled={busy || code.length < 6 || !okEmail}
            onClick={() => run(async () => { await backend.verifyCode(mail, code); })}>{t("verify")}</button>
          <button className="btn plain block press" disabled={busy || !okEmail} onClick={send}>{t("resendEmail")}</button>
        </>
      ) : (
        <button className="btn block press" disabled={busy || !okEmail} onClick={send}>{t("sendLink")}</button>
      ))}
      <button className="link" onClick={() => { setMode(mode === "email" ? "signin" : "email"); setErr(""); setInfo(""); }}>
        {mode === "email" ? t("usePassword") : t("useEmailLink")}
      </button>
    </div>
  );
}

/** Name + language → family → baby → invite partner. Steps skip what already exists. */
export function Onboarding() {
  const { t, user, profile, family, babies, saveProfile, saveBaby, refresh } = useApp();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [lang, setLang] = useState<Lang>(profile?.language ?? (navigator.language.startsWith("he") ? "he" : "en"));
  const [famMode, setFamMode] = useState<"create" | "join">("create");
  const [code, setCode] = useState("");
  const [baby, setBaby] = useState<Baby>({ id: uuid(), family_id: family?.id ?? "", name: "", birth_date: null, sex: null });
  const [showInvite, setShowInvite] = useState(false);
  const [err, setErr] = useState("");
  const cloud = backend.mode === "supabase";

  const step = !profile ? "you" : !family ? "family" : showInvite ? "invite" : !babies.length ? "baby" : "invite";

  const run = async (fn: () => Promise<void>) => {
    setErr("");
    try { await fn(); } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="onb">
      {step === "you" && (
        <>
          <Moon size={44} color="var(--c-sleep)" />
          <div>
            <h1 className="t-large" style={{ margin: "0 0 8px" }}>{t("welcome")}</h1>
            <p className="t-callout muted" style={{ margin: 0 }}>{t("welcomeSub")}</p>
          </div>
          <Seg value={lang} onChange={(v) => { setLang(v); document.documentElement.dir = v === "he" ? "rtl" : "ltr"; }}
            options={[{ value: "en", label: "English" }, { value: "he", label: "עברית" }]} />
          <div className="group">
            <label className="row"><span className="grow">{t("yourName")}</span>
              <input type="text" value={name} placeholder="Allan" autoFocus onChange={(e) => setName(e.target.value)} />
            </label>
          </div>
          <div className="spacer" />
          <button className="btn block press" disabled={!name.trim()} onClick={() => run(async () => {
            await saveProfile({ id: user!.id, display_name: name.trim(), language: lang, time_format: "24h" });
            if (!cloud && !family) await backend.createFamily("Family");
            await refresh();
          })}>{t("continue")}</button>
        </>
      )}

      {step === "family" && (
        <>
          <h1 className="t-large" style={{ margin: 0 }}>{t("family")}</h1>
          <Seg value={famMode} onChange={setFamMode}
            options={[{ value: "create", label: t("createFamily") }, { value: "join", label: t("joinFamily") }]} />
          {famMode === "join" && (
            <div className="group">
              <label className="row"><span className="grow">{t("inviteCode")}</span>
                <input type="text" value={code} placeholder="ABC123" maxLength={6} style={{ textTransform: "uppercase" }} onChange={(e) => setCode(e.target.value)} />
              </label>
            </div>
          )}
          {err && <p className="t-foot" style={{ margin: 0, color: "var(--danger)" }}>{err}</p>}
          <div className="spacer" />
          <button className="btn block press" disabled={famMode === "join" && code.trim().length < 6} onClick={() => run(async () => {
            if (famMode === "create") await backend.createFamily(`${profile!.display_name}'s family`);
            else await backend.joinFamily(code);
            await refresh();
          })}>{famMode === "create" ? t("createFamily") : t("join")}</button>
        </>
      )}

      {step === "baby" && (
        <>
          <h1 className="t-large" style={{ margin: 0 }}>{t("addBaby")}</h1>
          <BabyForm baby={baby} onChange={setBaby} />
          {err && <p className="t-foot" style={{ margin: 0, color: "var(--danger)" }}>{err}</p>}
          <div className="spacer" />
          <button className="btn block press" disabled={!baby.name.trim()} onClick={() => run(async () => {
            await saveBaby({ ...baby, name: baby.name.trim(), family_id: family!.id });
            // In cloud mode, show the invite code before entering the app.
            if (cloud) setShowInvite(true);
            else await refresh();
          })}>{t("continue")}</button>
        </>
      )}

      {step === "invite" && (
        <>
          <h1 className="t-large" style={{ margin: 0 }}>{t("invitePartner")}</h1>
          <p className="t-callout muted" style={{ margin: 0 }}>{t("invitePartnerSub")}</p>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="t-large num" style={{ letterSpacing: "0.2em" }}>{family?.invite_code}</div>
          </div>
          <ShareInvite code={family?.invite_code ?? ""} />
          <div className="spacer" />
          <button className="btn block press" onClick={() => { setShowInvite(false); refresh(); }}>{t("goToToday")}</button>
        </>
      )}
    </div>
  );
}

export function ShareInvite({ code }: { code: string }) {
  const { t } = useApp();
  const text = `Join our baby tracker on Lulu: ${window.location.origin + window.location.pathname}\nInvite code: ${code}`;
  return (
    <button className="btn soft block press" onClick={() => {
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else navigator.clipboard?.writeText(text);
    }}><Share size={18} />{t("shareInvite")}</button>
  );
}
