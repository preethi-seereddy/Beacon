import type { LeaderRow } from "./types";

/** Firefly-themed levels: each one glows a little brighter. */
export const LEVELS = [
  { min: 0, name: "Spark" },
  { min: 20, name: "Glow" },
  { min: 60, name: "Lantern" },
  { min: 120, name: "Lighthouse" },
  { min: 250, name: "Beacon" },
] as const;

export function levelFor(points: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].min) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  const pct = next ? Math.round(((points - cur.min) / (next.min - cur.min)) * 100) : 100;
  return { name: cur.name, next: next?.name ?? null, toNext: next ? next.min - points : 0, pct };
}

export interface Badge {
  id: string;
  name: string;
  desc: string;
  earned: boolean;
  tone: "mint" | "pink" | "yellow" | "blue";
  icon: "check" | "shield" | "award" | "ramp" | "star";
}

export function badgesFor(me: Pick<LeaderRow, "points" | "verifiedReports" | "checks"> | null): Badge[] {
  const p = me?.points ?? 0;
  const v = me?.verifiedReports ?? 0;
  const c = me?.checks ?? 0;
  return [
    { id: "first-check", name: "First check", desc: "Confirm or dispute a report", earned: c >= 1, tone: "mint", icon: "check" },
    { id: "verifier", name: "Verifier", desc: "Check 5 reports", earned: c >= 5, tone: "blue", icon: "shield" },
    { id: "trailblazer", name: "Trailblazer", desc: "Have a report confirmed", earned: v >= 1, tone: "pink", icon: "ramp" },
    { id: "lantern", name: "Lantern", desc: "Reach 60 points", earned: p >= 60, tone: "yellow", icon: "star" },
  ];
}
