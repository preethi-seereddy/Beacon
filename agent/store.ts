// Beau's server-side data layer.
//
// Same Supabase project AND the same tables as the website (supabase/schema.sql):
// a report texted to Beau lands in `reports` with source = 'beau' and shows on the
// web map; a report filed on the web can trigger alerts over iMessage. Votes go
// into `report_votes`, exactly like the app's confirm/dispute buttons, so the
// status rules in src/lib/status.ts apply to both.
//
// Uses the SERVICE ROLE key because `subscribers` holds phone numbers and is
// deliberately invisible to the public web key.
//
// With no Supabase configured everything falls back to memory, so the agent
// still demos on bad conference wifi.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { reportStatus } from "../src/lib/status";
import type { Report, ReportCategory, ReportStatus } from "../src/lib/types";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const db: SupabaseClient | null = URL && KEY ? createClient(URL, KEY) : null;

/** Where a message reached Beau. Every Beau report is stored with source = 'beau'. */
export type Source = "imessage" | "sms" | "email";

export interface Subscriber {
  id: string;
  platform: string;
  handle: string;
  space_id: string;
  agent_user_id: string;
  /** Start node id (src/lib/campus.ts NODES). */
  saved_from: string | null;
  /** Destination building id (src/lib/campus.ts BUILDINGS). */
  saved_to: string | null;
  alerts: boolean;
}

/** A report as Beau sees it: the website's Report plus who filed it. */
export type BeauReport = Report & { reporterId: string | null; source: "app" | "beau" };

interface Row {
  id: string;
  category: ReportCategory;
  lat: number;
  lng: number;
  edge_id: string | null;
  location_label: string;
  description: string | null;
  photo_url: string | null;
  reporter_id: string | null;
  source: "app" | "beau";
  created_at: string;
  resolved_at: string | null;
  confirmations: number;
  disputes: number;
}

const fromRow = (r: Row): BeauReport => ({
  id: r.id,
  category: r.category,
  lat: r.lat,
  lng: r.lng,
  edgeId: r.edge_id,
  locationLabel: r.location_label,
  description: r.description ?? "",
  photoUrl: r.photo_url,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
  confirmations: Number(r.confirmations) || 0,
  disputes: Number(r.disputes) || 0,
  reporterId: r.reporter_id,
  source: r.source,
});

// ---- memory fallback -------------------------------------------------------
const mem = {
  reports: [] as BeauReport[],
  votes: new Map<string, "confirm" | "dispute">(), // `${reportId}|${voterId}` -> vote
  subscribers: [] as Subscriber[],
  asks: [] as { id: string; report_id: string; subscriber_id: string; answer: string | null }[],
};
const uid = () => globalThis.crypto?.randomUUID?.() ?? `m_${Date.now()}_${Math.random()}`;

function memCounts(r: BeauReport): BeauReport {
  let confirmations = 0, disputes = 0;
  for (const [k, v] of mem.votes) {
    if (!k.startsWith(`${r.id}|`)) continue;
    if (v === "confirm") confirmations++;
    else disputes++;
  }
  return { ...r, confirmations, disputes };
}

// ---- reports ---------------------------------------------------------------
/** Every report that isn't resolved — what routing should take into account. */
export async function openReports(): Promise<BeauReport[]> {
  if (!db) return mem.reports.filter((r) => !r.resolvedAt).map(memCounts);
  const { data, error } = await db.from("reports_with_counts").select("*").is("resolved_at", null).limit(500);
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

/** Reports created after `sinceIso`, oldest first (the alert watcher's feed). */
export async function reportsSince(sinceIso: string): Promise<BeauReport[]> {
  if (!db) return mem.reports.filter((r) => r.createdAt > sinceIso && !r.resolvedAt).map(memCounts);
  const { data, error } = await db
    .from("reports_with_counts").select("*")
    .gt("created_at", sinceIso).is("resolved_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function getReport(id: string): Promise<BeauReport | null> {
  if (!db) {
    const r = mem.reports.find((x) => x.id === id);
    return r ? memCounts(r) : null;
  }
  const { data, error } = await db.from("reports_with_counts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
}

export async function insertReport(r: {
  category: ReportCategory;
  edgeId: string | null;
  lat: number;
  lng: number;
  locationLabel: string;
  description?: string;
  photoUrl?: string;
  reporterId?: string;
}): Promise<BeauReport> {
  if (!db) {
    const o: BeauReport = {
      id: uid(), category: r.category, lat: r.lat, lng: r.lng, edgeId: r.edgeId,
      locationLabel: r.locationLabel, description: r.description ?? "", photoUrl: r.photoUrl ?? null,
      createdAt: new Date().toISOString(), resolvedAt: null, confirmations: 0, disputes: 0,
      reporterId: r.reporterId ?? null, source: "beau",
    };
    mem.reports.push(o);
    return o;
  }
  const { data, error } = await db.from("reports").insert({
    category: r.category,
    lat: r.lat,
    lng: r.lng,
    edge_id: r.edgeId,
    location_label: r.locationLabel,
    description: r.description ?? "",
    photo_url: r.photoUrl ?? null,
    reporter_id: r.reporterId ?? null,
    source: "beau",
  }).select("id").single();
  if (error) throw error;
  return (await getReport((data as { id: string }).id))!;
}

/** Disputes outnumbering confirmations by this much = the community says it's gone. */
const AUTO_RESOLVE_NET = 2;

/**
 * Confirm or dispute, one vote per person (same table as the app's buttons,
 * voter_id = "beau:<subscriber id>"). Status follows src/lib/status.ts.
 */
export async function voteReport(
  id: string,
  agrees: boolean,
  voterId: string,
): Promise<{ status: ReportStatus; verified: boolean; resolved: boolean } | null> {
  const vote = agrees ? "confirm" : "dispute";
  if (!db) {
    if (!mem.reports.some((x) => x.id === id)) return null;
    mem.votes.set(`${id}|${voterId}`, vote);
  } else {
    const { error } = await db
      .from("report_votes")
      .upsert({ report_id: id, voter_id: voterId, vote }, { onConflict: "report_id,voter_id" });
    if (error) throw error;
  }

  let r = await getReport(id);
  if (!r) return null;
  if (!r.resolvedAt && r.disputes - r.confirmations >= AUTO_RESOLVE_NET) {
    await markResolved(id);
    r = { ...r, resolvedAt: new Date().toISOString() };
  }
  const status = reportStatus(r);
  return { status, verified: status === "confirmed", resolved: status === "resolved" };
}

export async function markResolved(id: string) {
  const now = new Date().toISOString();
  if (!db) {
    const m = mem.reports.find((x) => x.id === id);
    if (m) m.resolvedAt = now;
    return;
  }
  await db.from("reports").update({ resolved_at: now }).eq("id", id);
}

// ---- subscribers -----------------------------------------------------------
export async function upsertSubscriber(s: {
  platform: string; handle: string; space_id: string; agent_user_id: string;
}): Promise<Subscriber> {
  if (!db) {
    let m = mem.subscribers.find((x) => x.platform === s.platform && x.handle === s.handle);
    if (!m) {
      m = { id: uid(), saved_from: null, saved_to: null, alerts: true, ...s };
      mem.subscribers.push(m);
    } else Object.assign(m, s);
    return m;
  }
  const { data, error } = await db.from("subscribers")
    .upsert({ ...s, updated_at: new Date().toISOString() }, { onConflict: "platform,handle" })
    .select().single();
  if (error) throw error;
  return data as Subscriber;
}

export async function updateSubscriber(id: string, patch: Partial<Subscriber>) {
  if (!db) {
    const m = mem.subscribers.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
    return;
  }
  await db.from("subscribers").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}

export async function alertSubscribers(): Promise<Subscriber[]> {
  if (!db) return mem.subscribers.filter((s) => s.alerts);
  const { data } = await db.from("subscribers").select("*").eq("alerts", true);
  return (data ?? []) as Subscriber[];
}

// ---- verification asks -----------------------------------------------------
export async function createAsk(reportId: string, subscriberId: string) {
  if (!db) { mem.asks.push({ id: uid(), report_id: reportId, subscriber_id: subscriberId, answer: null }); return; }
  await db.from("verification_asks").insert({ report_id: reportId, subscriber_id: subscriberId });
}

/** The most recent unanswered question Beau asked this person, if any. */
export async function pendingAsk(subscriberId: string): Promise<{ id: string; report_id: string } | null> {
  if (!db) {
    const a = [...mem.asks].reverse().find((x) => x.subscriber_id === subscriberId && !x.answer);
    return a ?? null;
  }
  const { data } = await db.from("verification_asks").select("id,report_id")
    .eq("subscriber_id", subscriberId).is("answer", null)
    .order("asked_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

export async function answerAsk(askId: string, answer: "yes" | "no") {
  if (!db) { const a = mem.asks.find((x) => x.id === askId); if (a) a.answer = answer; return; }
  await db.from("verification_asks").update({ answer, answered_at: new Date().toISOString() }).eq("id", askId);
}

// ---- photos ----------------------------------------------------------------
/** Store a texted photo in the same public bucket the app uses and return its URL. */
export async function uploadPhoto(bytes: Blob, contentType: string): Promise<string | undefined> {
  if (!db) return undefined;
  const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
  const path = `beau/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await db.storage.from("report-photos").upload(path, bytes, { contentType });
  if (error) { console.error("[store] photo upload failed:", error.message); return undefined; }
  return db.storage.from("report-photos").getPublicUrl(path).data.publicUrl;
}
