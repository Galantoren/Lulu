import { useState } from "react";
import { Moon, Share } from "lucide-react";
import { useApp } from "../state/AppContext";
import { BabyForm } from "../sheets/BabySheets";
import { backend, uuid } from "../lib/backend";
import type { Baby } from "../types";

const EMAIL_KEY = "lulu:loginEmail";

/** Small EN / עברית switch for screens before the profile exists. */
function LangPill() {
  const { lang, setSettings } = useApp();
  return (
    <button className="lang-pill press" onClick={() => setSettings({ language: lang === "he" ? "en" : "he" })}>
      {lang === "he" ? "English" : "עברית"}
    </button>
  );
}

function ErrorText({ text }: { text: string }) {
  return text ? <p className="t-foot" role="alert" style={{ margin: 0, color: "var(--danger)" }}>{text}</p> : null;
}

function useRun() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setErr("");
    setBusy(true);
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return { err, setErr, busy, run };
}

export function Login() {
  const { t, authError, user, refresh } = useApp();
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");
  const { err, setErr, busy, run } = useRun();
  const mail = email.trim();
  const ok = mail.includes("@") && password.length >= 6;

  if (user) {
    // Signed in, but loading the family failed: say so instead of asking to sign in again.
    return (
      <div className="onb">
        <Moon size={44} color="var(--c-sleep)" />
        <p className="t-callout" style={{ margin: 0 }}>{t("signedInAs", { email: user.email ?? "" })}</p>
        <ErrorText text={err || authError} />
        <div className="spacer" />
        <button className="btn block press" onClick={() => refresh()}>{t("tryAgain")}</button>
        <button className="btn plain block press" onClick={() => backend.signOut()}>{t("signOut")}</button>
      </div>
    );
  }

  const submit = () => run(async () => {
    localStorage.setItem(EMAIL_KEY, mail);
    if (!creating) return backend.signInWithPassword(mail, password);
    const signedIn = await backend.signUp(mail, password);
    if (!signedIn) setInfo(t("confirmEmailFirst"));
  });

  return (
    <div className="onb">
      <div className="onb-top"><span className="onb-moon"><Moon size={30} /></span><LangPill /></div>
      <div>
        <h1 className="t-large" style={{ margin: "0 0 8px" }}>{creating ? t("createAccountTitle") : t("welcome")}</h1>
        <p className="t-callout muted" style={{ margin: 0 }}>{creating ? t("createAccountSub") : t("welcomeSub")}</p>
      </div>
      <form className="group" onSubmit={(e) => { e.preventDefault(); if (ok) submit(); }}>
        <label className="row"><span>{t("email")}</span>
          <input type="email" autoComplete="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="row"><span>{t("password")}</span>
          <input type="password" value={password} placeholder={creating ? t("passwordHint") : "••••••"}
            autoComplete={creating ? "new-password" : "current-password"} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
      {info && <p className="t-foot" style={{ margin: 0 }}>{info}</p>}
      <ErrorText text={err || authError} />
      <div className="spacer" />
      <button className="btn block press" disabled={busy || !ok} onClick={submit}>{creating ? t("createAccount") : t("signIn")}</button>
      <p className="switch-line">
        {creating ? t("haveAccount") : t("newHere")}{" "}
        <button className="link-inline" onClick={() => { setCreating(!creating); setErr(""); setInfo(""); }}>
          {creating ? t("signIn") : t("createAccount")}
        </button>
      </p>
    </div>
  );
}

/** Family (create or join) → baby → invite partner. Steps skip what already exists. */
export function Onboarding() {
  const { t, lang, user, profile, family, babies, saveProfile, saveBaby, refresh } = useApp();
  const [joining, setJoining] = useState(false);
  const [famName, setFamName] = useState("");
  const [code, setCode] = useState("");
  const [baby, setBaby] = useState<Baby>({ id: uuid(), family_id: family?.id ?? "", name: "", birth_date: null, sex: null });
  const [showInvite, setShowInvite] = useState(false);
  const { err, setErr, busy, run } = useRun();
  const cloud = backend.mode === "supabase";

  const step = !family ? "family" : showInvite ? "invite" : !babies.length ? "baby" : "invite";

  /** The parent's name defaults to the start of their email; it can be changed later in More. */
  async function ensureProfile() {
    if (profile) return;
    const fromEmail = user?.email?.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
    const name = fromEmail ? fromEmail[0]!.toUpperCase() + fromEmail.slice(1) : "Parent";
    await saveProfile({ id: user!.id, display_name: name, language: lang, time_format: "24h" });
  }

  return (
    <div className="onb">
      <div className="onb-top"><span className="onb-moon"><Moon size={30} /></span>{step !== "invite" && <LangPill />}</div>

      {step === "family" && (
        <>
          <div>
            <h1 className="t-large" style={{ margin: "0 0 8px" }}>{joining ? t("joinFamilyTitle") : t("createFamilyTitle")}</h1>
            <p className="t-callout muted" style={{ margin: 0 }}>{joining ? t("joinFamilySub") : t("createFamilySub")}</p>
          </div>
          <div className="group">
            {joining ? (
              <label className="row"><span className="grow">{t("inviteCode")}</span>
                <input type="text" value={code} placeholder="ABC123" maxLength={6} autoCapitalize="characters"
                  style={{ textTransform: "uppercase", letterSpacing: "0.2em" }} onChange={(e) => setCode(e.target.value)} />
              </label>
            ) : (
              <label className="row"><span className="grow">{t("familyName")}</span>
                <input type="text" value={famName} placeholder={t("familyNamePh")} onChange={(e) => setFamName(e.target.value)} />
              </label>
            )}
          </div>
          <ErrorText text={err} />
          <div className="spacer" />
          <button className="btn block press" disabled={busy || (joining ? code.trim().length < 6 : !famName.trim())} onClick={() => run(async () => {
            await ensureProfile();
            if (joining) await backend.joinFamily(code);
            else await backend.createFamily(famName.trim());
            await refresh();
          })}>{joining ? t("join") : t("createFamily")}</button>
          {cloud && (
            <p className="switch-line">
              {joining ? t("noCode") : t("haveCode2")}{" "}
              <button className="link-inline" onClick={() => { setJoining(!joining); setErr(""); }}>
                {joining ? t("createFamily") : t("joinFamily")}
              </button>
            </p>
          )}
        </>
      )}

      {step === "baby" && (
        <>
          <div>
            <h1 className="t-large" style={{ margin: "0 0 8px" }}>{t("addBabyTitle")}</h1>
            <p className="t-callout muted" style={{ margin: 0 }}>{family?.name}</p>
          </div>
          <BabyForm baby={baby} onChange={setBaby} />
          <ErrorText text={err} />
          <div className="spacer" />
          <button className="btn block press" disabled={busy || !baby.name.trim()} onClick={() => run(async () => {
            await ensureProfile();
            await saveBaby({ ...baby, name: baby.name.trim(), family_id: family!.id });
            // In cloud mode, show the invite code before entering the app.
            if (cloud) setShowInvite(true);
            else await refresh();
          })}>{t("continue")}</button>
        </>
      )}

      {step === "invite" && (
        <>
          <div>
            <h1 className="t-large" style={{ margin: "0 0 8px" }}>{t("invitePartner")}</h1>
            <p className="t-callout muted" style={{ margin: 0 }}>{t("invitePartnerSub")}</p>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="t-large num" style={{ letterSpacing: "0.2em" }}>{family?.invite_code}</div>
          </div>
          <ShareInvite code={family?.invite_code ?? ""} />
          <ErrorText text={err} />
          <div className="spacer" />
          <button className="btn block press" disabled={busy} onClick={() => run(async () => { await refresh(); setShowInvite(false); })}>{t("goToToday")}</button>
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
