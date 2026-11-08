import type { Report, ReportCategory, ReportStatus } from "./types";

/**
 * Community verification rules:
 * - resolved once someone marks it fixed (resolvedAt set)
 * - unverified until at least one other person confirms
 * - disputed when disputes reach or pass confirmations
 * - confirmed otherwise
 */
export function reportStatus(r: Pick<Report, "confirmations" | "disputes" | "resolvedAt">): ReportStatus {
  if (r.resolvedAt) return "resolved";
  if (r.disputes > 0 && r.disputes >= r.confirmations) return "disputed";
  if (r.confirmations > 0) return "confirmed";
  return "unverified";
}

export const STATUS_LABEL: Record<ReportStatus, string> = {
  unverified: "Unverified",
  confirmed: "Confirmed",
  disputed: "Disputed",
  resolved: "Resolved",
};

export const STATUS_HELP: Record<ReportStatus, string> = {
  unverified: "Not yet checked by others",
  confirmed: "Others saw it too",
  disputed: "Reports disagree",
  resolved: "Fixed or cleared",
};

export const CATEGORY: Record<ReportCategory, { label: string; short: string; icon: "elev" | "ramp" | "stairs" | "cone" | "door" | "dots"; tone: "pink" | "yellow" | "blue" | "plain" }> = {
  broken_elevator: { label: "Broken elevator", short: "Broken elevator", icon: "elev", tone: "blue" },
  blocked_ramp: { label: "Blocked ramp", short: "Blocked ramp", icon: "ramp", tone: "pink" },
  stairs_path: { label: "Stairs or inaccessible path", short: "Stairs / path", icon: "stairs", tone: "yellow" },
  construction: { label: "Construction", short: "Construction", icon: "cone", tone: "yellow" },
  blocked_entrance: { label: "Blocked entrance", short: "Blocked entrance", icon: "door", tone: "pink" },
  other: { label: "Other", short: "Other", icon: "dots", tone: "plain" },
};

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
