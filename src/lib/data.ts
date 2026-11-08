"use client";

/**
 * Reports data access. Uses Supabase when configured (see supabase/schema.sql),
 * otherwise a demo store in localStorage so the app works out of the box.
 * The Photon/Beau backend should write to the same Supabase tables.
 */
import { NODE_BY_ID } from "./campus";
import { nearestEdge } from "./routing";
import { PHOTO_BUCKET, supabase } from "./supabase";
import type { NewReport, Report } from "./types";

const LS_REPORTS = "beacon:reports:v1";
const LS_VOTES = "beacon:votes:v1";
const LS_VOTER = "beacon:voter";
const EVENT = "beacon:reports-changed";

export const usingSupabase = !!supabase;

function safeGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function safeSet(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable (private mode) — demo data just won't persist */
  }
}

export function voterId(): string {
  let id = safeGet<string | null>(LS_VOTER, null);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
    safeSet(LS_VOTER, id);
  }
  return id;
}

function myVotes(): Record<string, "confirm" | "dispute"> {
  return safeGet(LS_VOTES, {} as Record<string, "confirm" | "dispute">);
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function onReportsChanged(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

// ---------- demo seed ----------
function mid(edgeA: string, edgeB: string): [number, number] {
  const a = NODE_BY_ID.get(edgeA)!.pos;
  const b = NODE_BY_ID.get(edgeB)!.pos;
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
function ago(min: number) {
  return new Date(Date.now() - min * 60000).toISOString();
}
function seed(): Report[] {
  const [l1, g1] = mid("SSA_N", "J7");
  const [l2, g2] = mid("J3", "J4");
  const [l3, g3] = mid("J9", "J12");
  const [l4, g4] = mid("SU_N", "J2");
  return [
    { id: "demo-ramp-ssa", category: "blocked_ramp", lat: l1, lng: g1, edgeId: "SSA_N|J7", locationLabel: "Near SSA · north ramp", description: "Delivery cart parked across the bottom of the ramp. No way around it in a chair.", photoUrl: null, createdAt: ago(20), resolvedAt: null, confirmations: 4, disputes: 1 },
    { id: "demo-construction-lib", category: "construction", lat: l2, lng: g2, edgeId: "J3|J4", locationLabel: "Library Walk", description: "Fencing on the south side of the walk, narrow gap.", photoUrl: null, createdAt: ago(120), resolvedAt: null, confirmations: 0, disputes: 0 },
    { id: "demo-elevator-jsom", category: "broken_elevator", lat: l3, lng: g3, edgeId: "JSOM_ELEV", locationLabel: "JSOM east elevator", description: "Out of service sign on the door.", photoUrl: null, createdAt: ago(60 * 26), resolvedAt: null, confirmations: 2, disputes: 2 },
    { id: "demo-entrance-su", category: "blocked_entrance", lat: l4, lng: g4, edgeId: "SU_N|J2", locationLabel: "Student Union north entrance", description: "Power door button not working.", photoUrl: null, createdAt: ago(60 * 40), resolvedAt: ago(60 * 20), confirmations: 3, disputes: 0 },
  ];
}

function localAll(): Report[] {
  let r = safeGet<Report[] | null>(LS_REPORTS, null);
  if (!r) {
    r = seed();
    safeSet(LS_REPORTS, r);
  }
  const v = myVotes();
  return r.map((x) => ({ ...x, myVote: v[x.id] ?? null }));
}

// ---------- Supabase mapping ----------
interface Row {
  id: string;
  category: Report["category"];
  lat: number;
  lng: number;
  edge_id: string | null;
  location_label: string;
  description: string | null;
  photo_url: string | null;
  created_at: string;
  resolved_at: string | null;
  confirmations: number;
  disputes: number;
}
const fromRow = (r: Row): Report => ({
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
  myVote: myVotes()[r.id] ?? null,
});

// ---------- public API ----------
export async function listReports(): Promise<Report[]> {
  if (supabase) {
    const { data, error } = await supabase.from("reports_with_counts").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return (data as Row[]).map(fromRow);
  }
  return localAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getReport(id: string): Promise<Report | null> {
  if (supabase) {
    const { data, error } = await supabase.from("reports_with_counts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as Row) : null;
  }
  return localAll().find((r) => r.id === id) ?? null;
}

export async function createReport(input: NewReport): Promise<Report> {
  const snapped = nearestEdge([input.lat, input.lng]);
  const edgeId = snapped.meters < 40 ? snapped.edge.id : null;

  if (supabase) {
    let photoUrl: string | null = null;
    if (input.photo) {
      const path = `${voterId()}/${Date.now()}-${input.photo.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, input.photo, { contentType: input.photo.type });
      if (!up.error) photoUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await supabase
      .from("reports")
      .insert({ category: input.category, lat: input.lat, lng: input.lng, edge_id: edgeId, location_label: input.locationLabel, description: input.description, photo_url: photoUrl, reporter_id: voterId() })
      .select("id")
      .single();
    if (error) throw error;
    notify();
    return (await getReport((data as { id: string }).id))!;
  }

  const r: Report = {
    id: `local-${Date.now().toString(36)}`,
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    edgeId,
    locationLabel: input.locationLabel,
    description: input.description,
    // Demo mode keeps photos only for this session.
    photoUrl: input.photo ? URL.createObjectURL(input.photo) : null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    confirmations: 0,
    disputes: 0,
  };
  const all = safeGet<Report[]>(LS_REPORTS, seed());
  safeSet(LS_REPORTS, [{ ...r, photoUrl: null }, ...all]);
  notify();
  return r;
}

export async function voteReport(id: string, vote: "confirm" | "dispute"): Promise<Report | null> {
  const votes = myVotes();
  const prev = votes[id];
  if (prev === vote) return getReport(id);
  votes[id] = vote;
  safeSet(LS_VOTES, votes);

  if (supabase) {
    const { error } = await supabase.from("report_votes").upsert({ report_id: id, voter_id: voterId(), vote }, { onConflict: "report_id,voter_id" });
    if (error) throw error;
  } else {
    const all = safeGet<Report[]>(LS_REPORTS, seed()).map((r) => {
      if (r.id !== id) return r;
      const n = { ...r };
      if (prev === "confirm") n.confirmations--;
      if (prev === "dispute") n.disputes--;
      if (vote === "confirm") n.confirmations++;
      else n.disputes++;
      return n;
    });
    safeSet(LS_REPORTS, all);
  }
  notify();
  return getReport(id);
}

export async function markResolved(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("reports").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  } else {
    safeSet(
      LS_REPORTS,
      safeGet<Report[]>(LS_REPORTS, seed()).map((r) => (r.id === id ? { ...r, resolvedAt: new Date().toISOString() } : r)),
    );
  }
  notify();
}
