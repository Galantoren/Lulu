import { Moon, Milk, Baby as BabyIcon, Droplets, HeartPulse, type LucideIcon } from "lucide-react";
import type { Category, Subtype } from "../types";

export const CATEGORY_ORDER: Category[] = ["sleep", "feeding", "diaper", "pumping", "health"];

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  sleep: Moon,
  feeding: Milk,
  diaper: BabyIcon,
  pumping: Droplets,
  health: HeartPulse,
};

/** CSS custom property holding the category's main colour. */
export const catVar = (c: Category) => `var(--c-${c})`;

/** Night sleep if it starts between 19:00 and 06:00. */
export function suggestSleepType(d = new Date()): Subtype {
  const h = d.getHours();
  return h >= 19 || h < 6 ? "night" : "nap";
}

export function suggestMeal(d = new Date()): "breakfast" | "lunch" | "dinner" | "snack" {
  const h = d.getHours();
  if (h >= 5 && h < 10) return "breakfast";
  if (h >= 11 && h < 14) return "lunch";
  if (h >= 17 && h < 20) return "dinner";
  return "snack";
}

/** Timers running longer than this get a gentle "still going?" banner. */
export const LONG_RUNNING_HOURS: Partial<Record<Category, number>> = {
  sleep: 14,
  feeding: 4,
  pumping: 4,
};
