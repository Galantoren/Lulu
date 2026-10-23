/** Per-device preferences (not synced). */
export interface DeviceSettings {
  appearance: "system" | "light" | "dark";
  nightMode: boolean;
  activeBabyId: string | null;
  lastFeedSubtype: "breastfeeding" | "bottle" | "solids";
  lastBottleMl: number;
  lastMilkType: "formula" | "breastmilk";
  lastBrand: string;
  /** Language chosen before signing in; the profile's language wins once it exists. */
  language: "en" | "he" | null;
  /** History filters: categories or subtypes hidden, and subtypes drawn with a gradient stroke. */
  historyHidden: string[];
  historyHighlight: string[];
  /** Per baby: medicine/temperature before this time are hidden from the Today card (eraser). */
  healthClearedAt: Record<string, string>;
}

const KEY = "lulu:device";
const defaults: DeviceSettings = {
  appearance: "system",
  nightMode: false,
  activeBabyId: null,
  lastFeedSubtype: "breastfeeding",
  lastBottleMl: 120,
  lastMilkType: "formula",
  lastBrand: "",
  language: null,
  historyHidden: [],
  historyHighlight: ["dirty", "mixed"],
  healthClearedAt: {},
};

export function loadSettings(): DeviceSettings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return defaults;
  }
}

export function storeSettings(s: DeviceSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode — preferences just won't persist */
  }
}
