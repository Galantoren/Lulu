import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./state/AppContext";
import { Dock, TabBar, type Tab } from "./components/Chrome";
import { EventSheet } from "./sheets/EventSheet";
import { BabyEditSheet, BabyPickerSheet } from "./sheets/BabySheets";
import { ImportSheet } from "./sheets/ImportSheet";
import { FilterSheet } from "./sheets/FilterSheet";
import { Login, Onboarding } from "./screens/Onboarding";
import { Today } from "./screens/Today";
import { History } from "./screens/History";
import { Health } from "./screens/Health";
import { More } from "./screens/More";
import { ErrorBoundary } from "./components/ErrorBoundary";

function Shell() {
  const { phase, sheet, openSheet, events } = useApp();
  const [tab, setTab] = useState<Tab>("today");
  const runningCount = tab === "today" ? 0 : events.filter((e) => !e.ended_at).length;
  // Braces matter: newer browsers return a Promise from scrollTo, which React would call as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);
  const close = () => openSheet(null);
  // After signing out (or before setup is done), always come back to Today.
  useEffect(() => {
    if (phase !== "ready") setTab("today");
  }, [phase]);

  if (phase === "loading") return <div className="screen" aria-busy="true" />;
  if (phase === "login") return <Login />;
  if (phase === "onboarding") return <Onboarding />;

  return (
    <div className="app" style={{ ["--dock-h" as string]: `${runningCount * 64}px` }}>
      {/* A crash in one tab shows its error there; the tab bar keeps working */}
      <ErrorBoundary resetKey={tab}>
        {tab === "today" && <Today />}
        {tab === "history" && <History />}
        {tab === "health" && <Health />}
        {tab === "more" && <More />}
      </ErrorBoundary>
      {/* On Today the running timers are cards at the top, so the floating bars only show elsewhere */}
      <Dock showTimers={tab !== "today"} />
      <TabBar tab={tab} onChange={setTab} />
      <ErrorBoundary resetKey={sheet ? sheet.kind : "none"}>
      {sheet?.kind === "event" && <EventSheet key={sheet.event.id} initial={sheet.event} isNew={sheet.isNew} onClose={close} />}
      {sheet?.kind === "baby" && <BabyEditSheet baby={sheet.baby} onClose={close} />}
      {sheet?.kind === "babies" && <BabyPickerSheet onClose={close} />}
      {sheet?.kind === "import" && <ImportSheet onClose={close} />}
      {sheet?.kind === "filters" && <FilterSheet onClose={close} />}
      </ErrorBoundary>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  );
}
