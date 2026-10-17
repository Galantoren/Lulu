import type { BabyEvent, Side } from "../types";

/** Live seconds per side for a breastfeed, counting the side that is timing right now. */
export function sideSeconds(e: BabyEvent, now: number): { L: number; R: number } {
  const s = { L: e.data.sides?.L ?? 0, R: e.data.sides?.R ?? 0 };
  if (!e.ended_at && e.data.active_side && e.data.side_since) {
    s[e.data.active_side] += Math.max(0, (now - new Date(e.data.side_since).getTime()) / 1000);
  }
  return s;
}

/** Banks the active side's time and switches to `side` (or pauses when null). */
export function withSide(e: BabyEvent, side: Side | null, now: number): BabyEvent {
  const sides = sideSeconds(e, now);
  return {
    ...e,
    data: {
      ...e.data,
      sides: { L: Math.round(sides.L), R: Math.round(sides.R) },
      active_side: side,
      side_since: side ? new Date(now).toISOString() : null,
      last_side: side ?? e.data.active_side ?? e.data.last_side,
    },
  };
}

export const otherSide = (s: Side): Side => (s === "L" ? "R" : "L");
