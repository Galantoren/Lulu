import type { T } from "../i18n";
import { ageParts } from "./time";

/** "4 months, 2 weeks", "3 weeks", "5 days". */
export function ageLabel(birth: string | null, t: T): string {
  const a = ageParts(birth);
  if (!a) return "";
  if (a.days < 1) return t("newborn");
  if (a.days < 14) return t("days", { n: a.days });
  if (a.months < 1) return t("weeks", { n: Math.floor(a.days / 7) });
  const m = a.months === 1 ? t("month1") : t("months", { n: a.months });
  if (a.months >= 6 || a.weeks === 0) return m;
  return t("monthsWeeks", { m, w: a.weeks === 1 ? t("week1") : t("weeks", { n: a.weeks }) });
}
