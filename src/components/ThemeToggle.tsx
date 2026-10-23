import { Moon, Sun } from "lucide-react";
import { useApp } from "../state/AppContext";

/** Small sun/moon button that flips between light and dark. */
export function ThemeToggle() {
  const { t, settings, setSettings } = useApp();
  const dark =
    settings.appearance === "dark" ||
    (settings.appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button className="theme-toggle press" aria-label={dark ? t("light") : t("dark")}
      onClick={() => setSettings({ appearance: dark ? "light" : "dark" })}>
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
