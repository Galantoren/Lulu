import { useState } from "react";
import { ChevronLeft, ChevronRight, KeyRound, Moon, Plus, Share } from "lucide-react";
import { useApp } from "../state/AppContext";
import { BabyForm } from "../sheets/BabySheets";
import { backend, uuid } from "../lib/backend";
import { setStaySignedIn, staySignedIn } from "../lib/authStorage";
import { Switch } from "../components/Sheet";
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
  const [stay, setStay] = useState(staySignedIn);
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
      {/* A real form with a submit button lets iPhone offer to save the password and fill it with Face ID */}
      <form id="login-form" className="group" onSubmit={(e) => { e.preventDefault(); if (ok && !busy) submit(); }}>
        <label className="row"><span>{t("email")}</span>
          <input type="email" name="email" autoComplete="username" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="row"><span>{t("password")}</span>
          <input type="password" name="password" value={password} placeholder={creating ? t("passwordHint") : "••••••"}
            autoComplete={creating ? "new-password" : "current-password"} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="row">
          <span className="grow">{t("staySignedIn")}</span>
          <Switch checked={stay} label={t("staySignedIn")} onChange={(on) => { setStay(on); setStaySignedIn(on); }} />
        </label>
      </form>
      {info && <p className="t-foot" style={{ margin: 0 }}>{info}</p>}
      <ErrorText text={err || authError} />
      <div className="spacer" />
      <button type="submit" form="login-form" className="btn block press" disabled={busy || !ok}>{creating ? t("createAccount") : t("signIn")}</button>
      <p className="switch-line">
        {creating ? t("haveAccount") : t("newHere")}{" "}
        <button className="link-inline" onClick={() => { setCreating(!creating); setErr(""); setInfo(""); }}>
          {creating ? t("signIn") : t("createAccount")}
        </button>
      </p>
    </div>
  );
}

/** "Signed in as …  Not you? Sign out" so a wrong account is obvious. */
function SignedInAs() {
  const { t, user } = useApp();
  if (backend.mode !== "supabase" || !user?.email) return null;
  return (
    <p className="switch-line">
      {t("signedInAsShort", { email: user.email })}{" "}
      <button className="link-inline" onClick={() => backend.signOut()}>{t("notYou")}</button>
    </p>
  );
}

/** Family (create or join) → baby → invite partner. Steps skip what already exists. */
export function Onboarding() {
  const { t, lang, user, profile, family, babies, saveProfile, saveBaby, refresh } = useApp();
  // Cloud: first choose create vs join (with who is signed in). On-device there is only "create".
  const [famMode, setFamMode] = useState<"choose" | "create" | "join">(backend.mode === "supabase" ? "choose" : "create");
  const Back = lang === "he" ? ChevronRight : ChevronLeft;
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

      {step === "family" && famMode === "choose" && (
        <>
          <div>
            <h1 className="t-large" style={{ margin: "0 0 8px" }}>{t("setupFamilyTitle")}</h1>
            <p className="t-callout muted" style={{ margin: 0 }}>{t("setupFamilySub")}</p>
          </div>
          <div className="choice-list">
            <button className="choice press" onClick={() => setFamMode("join")}>
              <span className="choice-icon"><KeyRound size={22} /></span>
              <span className="grow"><b>{t("joinFamily")}</b><span className="t-sub">{t("joinFamilyHint")}</span></span>
            </button>
            <button className="choice press" onClick={() => setFamMode("create")}>
              <span className="choice-icon"><Plus size={22} /></span>
              <span className="grow"><b>{t("createNewFamily")}</b><span className="t-sub">{t("createFamilyHint")}</span></span>
            </button>
          </div>
          <div className="spacer" />
          <SignedInAs />
        </>
      )}

      {step === "family" && famMode !== "choose" && (
        <>
          {cloud && (
            <button className="link back-link" onClick={() => { setFamMode("choose"); setErr(""); }}>
              <Back size={20} />{t("back")}
            </button>
          )}
          <div>
            <h1 className="t-large" style={{ margin: "0 0 8px" }}>{famMode === "join" ? t("joinFamilyTitle") : t("createFamilyTitle")}</h1>
            <p className="t-callout muted" style={{ margin: 0 }}>{famMode === "join" ? t("joinFamilySub") : t("createFamilySub")}</p>
          </div>
          <div className="group">
            {famMode === "join" ? (
              <label className="row"><span className="grow">{t("inviteCode")}</span>
                <input type="text" value={code} placeholder="ABC123" maxLength={6} autoCapitalize="characters" autoFocus
                  style={{ textTransform: "uppercase", letterSpacing: "0.2em" }} onChange={(e) => setCode(e.target.value)} />
              </label>
            ) : (
              <label className="row"><span className="grow">{t("familyName")}</span>
                <input type="text" value={famName} placeholder={t("familyNamePh")} autoFocus onChange={(e) => setFamName(e.target.value)} />
              </label>
            )}
          </div>
          <ErrorText text={err} />
          <div className="spacer" />
          <button className="btn block press" disabled={busy || (famMode === "join" ? code.trim().length < 6 : !famName.trim())} onClick={() => run(async () => {
            await ensureProfile();
            if (famMode === "join") await backend.joinFamily(code);
            else await backend.createFamily(famName.trim());
            await refresh();
          })}>{famMode === "join" ? t("join") : t("createFamily")}</button>
          {cloud && <SignedInAs />}
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
