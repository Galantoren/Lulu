export type Category = "sleep" | "feeding" | "diaper" | "pumping" | "health";

export type Subtype =
  | "nap" | "night"
  | "breastfeeding" | "bottle" | "solids"
  | "wet" | "dirty" | "mixed" | "dry"
  | "pumping"
  | "medicine" | "temperature" | "growth";

export type Side = "L" | "R";

/** Free-form per-subtype payload, stored as JSON. */
export interface EventData {
  // sleep
  location?: string;
  // breastfeeding
  sides?: { L: number; R: number }; // accumulated seconds per side
  active_side?: Side | null; // side currently timing (running feeds only)
  side_since?: string | null; // ISO time the active side started
  last_side?: Side;
  amount_ml?: number;
  // bottle
  milk_type?: "formula" | "breastmilk";
  formula_brand?: string;
  // solids
  meal?: "breakfast" | "lunch" | "dinner" | "snack";
  description?: string;
  amount_eaten?: "taste" | "some" | "most" | "all";
  first_time?: boolean;
  reaction?: "none" | "liked" | "disliked" | "rash" | "upset" | "other";
  // diaper
  color?: string;
  texture?: "watery" | "runny" | "seedy" | "soft" | "formed" | "hard";
  // pumping
  left_ml?: number;
  right_ml?: number;
  to_stash?: boolean;
  // medicine
  name?: string;
  dose?: number;
  unit?: string;
  // temperature
  celsius?: number;
  method?: "forehead" | "ear" | "armpit" | "rectal" | "oral";
  // growth
  weight_kg?: number;
  length_cm?: number;
  head_cm?: number;
}

export interface BabyEvent {
  id: string;
  baby_id: string;
  family_id: string;
  category: Category;
  subtype: Subtype;
  started_at: string;
  ended_at: string | null; // null = timer running
  logged_by: string | null;
  note: string | null;
  data: EventData;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Baby {
  id: string;
  family_id: string;
  name: string;
  birth_date: string | null; // yyyy-mm-dd
  sex: "female" | "male" | null;
  photo_path?: string | null;
}

export interface Profile {
  id: string;
  display_name: string;
  language: Lang;
  time_format: "24h" | "12h";
}

export interface Family {
  id: string;
  name: string;
  invite_code: string;
}

export interface Member {
  user_id: string;
  display_name: string;
}

export type Lang = "en" | "he";
