import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./state/AppContext";
import { Dock, TabBar, type Tab } from "./components/Chrome";
import { EventSheet } from "./sheets/EventSheet";
import { BabyEditSheet, BabyPickerSheet } from "./sheets/BabySheets";
import { Login, Onboarding } from "./screens/Onboarding";
import { Today } from "./screens/Today";
import { History } from "./screens/History";
import { Health } from "./screens/Health";
import { More } from "./screens/More";

function Shell() {
  const { phase, sheet, openSheet, events } = useApp();
  const runningCount = events.filter((e) => !e.ended_at).length;
  const [tab, setTab] = useState<Tab>("today");
  useEffect(() => window.scrollTo(0, 0), [tab]);
  const close = () => openSheet(null);

  if (phase === "loading") return <div className="screen" aria-busy="true" />;
  if (phase === "login") return <Login />;
  if (phase === "onboarding") return <Onboarding />;

  return (
    <div className="app" style={{ ["--dock-h" as string]: `${runningCount * 64}px` }}>
      {tab === "today" && <Today />}
      {tab === "history" && <History />}
      {tab === "health" && <Health />}
      {tab === "more" && <More />}
      <Dock />
      <TabBar tab={tab} onChange={setTab} />
      {sheet?.kind === "event" && <EventSheet key={sheet.event.id} initial={sheet.event} isNew={sheet.isNew} onClose={close} />}
      {sheet?.kind === "baby" && <BabyEditSheet baby={sheet.baby} onClose={close} />}
      {sheet?.kind === "babies" && <BabyPickerSheet onClose={close} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
