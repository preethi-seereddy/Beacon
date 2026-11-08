// What the tools actually do.
//
// The model picks the tool and the arguments. Everything numeric happens here,
// deterministically, using the SAME campus graph (src/lib/campus.ts) and the SAME
// router (src/lib/routing.ts) as the website, so Beau and the map always agree
// and a hallucinated distance can never reach a user.

import { BUILDINGS, BUILDING_BY_ID, EDGES, NODES, NODE_BY_ID } from "../src/lib/campus";
import { planRoute } from "../src/lib/routing";
import { CATEGORY } from "../src/lib/status";
import type { CampusEdge, PlannedRoute, Preferences, ReportCategory } from "../src/lib/types";
import * as store from "./store";

// ---------------------------------------------------------------------------
// Places Beau understands
// ---------------------------------------------------------------------------

/** What people actually call these buildings. Every one is a question a judge might type. */
const ALIASES: Record<string, string[]> = {
  SU: ["union", "student", "center", "food", "dining", "comet", "cafe", "eat", "lunch", "hungry"],
  LIB: ["library", "mcdermott", "books", "study"],
  JSOM: ["business", "management", "naveen", "jindal", "som"],
  ECSW: ["engineering", "computer", "science", "ecs", "west"],
  ECSS: ["engineering", "computer", "science", "ecs", "south"],
  ECSN: ["engineering", "computer", "science", "ecs", "north"],
  ATC: ["atec", "arts", "technology", "animation"],
  SSA: ["student", "services", "ssb", "advising", "registrar"],
  ACT: ["activity", "gym", "rec", "recreation", "fitness"],
  VC: ["visitor", "visitors", "admissions", "tour"],
};

/** Words that carry no location meaning ("the ramp by the library"). */
const STOPWORDS = new Set([
  "the", "and", "for", "near", "next", "beside", "around", "from", "into", "get", "got", "can", "you",
  "that", "this", "with", "but", "its", "it's", "please", "where", "what", "how", "take", "one", "any",
  "out", "building", "hall", "bldg", "entrance", "door", "side",
]);

export type PlaceKind = "building" | "entrance" | "feature";
export interface Place {
  /** Building id, entrance node id, or edge id. */
  id: string;
  kind: PlaceKind;
  name: string;
  /** Building this place belongs to (for entrances, and features next to one). */
  building?: string;
  hay: string;
}

const tidy = (s: string) => s.replace(/^the\s+/i, "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The building an edge leads into, if either end is an entrance. */
function buildingOfEdge(e: CampusEdge): string | undefined {
  return NODE_BY_ID.get(e.a)?.building ?? NODE_BY_ID.get(e.b)?.building;
}

export const PLACES: Place[] = [
  ...BUILDINGS.map((b): Place => ({
    id: b.id,
    kind: "building",
    name: b.name,
    building: b.id,
    hay: `${b.name} ${b.short} ${b.id} ${(ALIASES[b.id] ?? []).join(" ")}`.toLowerCase(),
  })),
  ...NODES.filter((n) => n.kind === "entrance" && n.building).map((n): Place => {
    const b = BUILDING_BY_ID.get(n.building!)!;
    return {
      id: n.id,
      kind: "entrance",
      name: `${b.short} ${n.label ?? "entrance"}`,
      building: b.id,
      hay: `${b.name} ${b.short} ${b.id} ${(ALIASES[b.id] ?? []).join(" ")} ${n.label ?? ""} entrance door`.toLowerCase(),
    };
  }),
  // Named accessibility features: ramps, elevators, stairs ("the JSOM east elevator").
  ...EDGES.filter((e) => e.name && (e.ramp || e.elevator || e.stairs)).map((e): Place => {
    const bid = buildingOfEdge(e) ?? BUILDINGS.find((b) => e.name!.toLowerCase().includes(b.id.toLowerCase()))?.id;
    const b = bid ? BUILDING_BY_ID.get(bid) : undefined;
    return {
      id: e.id,
      kind: "feature",
      name: cap(tidy(e.name!)),
      building: bid,
      hay: `${e.name} ${e.ramp ? "ramp" : ""} ${e.elevator ? "elevator lift" : ""} ${e.stairs ? "stairs steps" : ""} ${b ? `${b.name} ${(ALIASES[b.id] ?? []).join(" ")}` : ""}`.toLowerCase(),
    };
  }),
];
const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]));

/** Human name for a node id, building id or edge id. */
export function placeName(id: string | null | undefined): string {
  if (!id) return "somewhere on campus";
  const p = PLACE_BY_ID.get(id);
  if (p) return p.name;
  const n = NODE_BY_ID.get(id);
  return n?.label ?? id;
}

/**
 * Fuzzy phrase -> places. Rare words count for more than common ones: "ramp"
 * should outweigh "student". Returns all plausible candidates so the model asks
 * rather than guesses — guessing wrong sends a wheelchair user to a dead end.
 */
export function resolve_location({ phrase }: { phrase: string }) {
  const words = phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w) && (w.length > 2 || PLACES.some((p) => p.id.toLowerCase() === w)));

  const weight = new Map<string, number>();
  for (const w of words) {
    const hits = PLACES.filter((p) => hasWord(p.hay, w)).length;
    weight.set(w, hits === 0 ? 0 : 1 / hits);
  }

  const scored = PLACES.map((p) => {
    const score = words.reduce((s, w) => s + (hasWord(p.hay, w) ? weight.get(w)! : 0), 0);
    // Buildings win near-ties: "the library" means the building, not one door.
    return { id: p.id, kind: p.kind, name: p.name, score: +(score * (p.kind === "building" ? 1.05 : 1)).toFixed(3) };
  })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const ambiguous = scored.length > 1 && scored[1].kind === scored[0].kind && scored[1].score >= scored[0].score * 0.85;
  return { candidates: scored.slice(0, 4), ambiguous };
}

/** Whole-word (or word-prefix) match, so "su" doesn't match "issue". */
function hasWord(hay: string, w: string) {
  return new RegExp(`(^|[^a-z0-9])${w.replace(/[^a-z0-9]/g, "")}`).test(hay);
}

/** Phrase or id -> the place it most likely means. */
function pick(phrase: string): Place | null {
  const direct = PLACE_BY_ID.get(phrase) ?? PLACE_BY_ID.get(phrase.toUpperCase());
  if (direct) return direct;
  const top = resolve_location({ phrase }).candidates[0];
  return top ? PLACE_BY_ID.get(top.id)! : null;
}

/** A starting point is a node: an entrance, a building's step-free door, or the end of a feature. */
export function startNodeFor(phrase: string): string | null {
  if (NODE_BY_ID.has(phrase)) return phrase;
  const p = pick(phrase);
  if (!p) return null;
  if (p.kind === "entrance") return p.id;
  if (p.kind === "building") {
    const b = BUILDING_BY_ID.get(p.id)!;
    return b.entrances.find((id) => NODE_BY_ID.get(id)?.stepFree !== false) ?? b.entrances[0] ?? null;
  }
  const e = EDGES.find((x) => x.id === p.id)!;
  return e.a;
}

/** A destination is a building (the router picks its best step-free entrance). */
export function buildingFor(phrase: string): string | null {
  if (BUILDING_BY_ID.has(phrase)) return phrase;
  const p = pick(phrase);
  return p?.building ?? null;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** Who Beau is talking to, so tools can act on that person's behalf. */
export interface ToolContext {
  subscriber?: store.Subscriber;
  source: store.Source;
  /** A photo the user texted that hasn't been attached to a report yet. */
  pendingPhotoUrl?: string;
  /** Set by submit_report so the bridge knows the photo was used. */
  usedPhoto?: boolean;
}

/** One id format for everything Beau does on someone's behalf (reports + votes). */
export const beauUserId = (ctx?: ToolContext) => (ctx?.subscriber ? `beau:${ctx.subscriber.id}` : "beau:anonymous");

export const DEFAULT_PREFS: Preferences = { stepFree: true, avoidStairs: true, avoidElevators: false, preferRamps: false };
/** What a normal maps app does: stairs are fine and nobody's reports count. */
const TYPICAL_PREFS: Preferences = { stepFree: false, avoidStairs: false, avoidElevators: false, preferRamps: false };

export function routeLines(r: PlannedRoute): string[] {
  return r.steps.map((s) => `${s.text}${s.detail ? ` (${s.detail})` : ""}`);
}

export async function find_accessible_route(args: {
  from: string;
  to: string;
  avoid_elevators?: boolean;
  prefer_ramps?: boolean;
  step_free?: boolean;
}) {
  const start = startNodeFor(args.from);
  const building = buildingFor(args.to);
  if (!start || !building) return { error: "unknown_location", from: args.from, to: args.to };
  if (NODE_BY_ID.get(start)?.building === building) return { error: "same_place", from: args.from, to: args.to };

  const prefs: Preferences = {
    ...DEFAULT_PREFS,
    stepFree: args.step_free ?? DEFAULT_PREFS.stepFree,
    avoidStairs: args.step_free ?? DEFAULT_PREFS.avoidStairs,
    avoidElevators: args.avoid_elevators ?? DEFAULT_PREFS.avoidElevators,
    preferRamps: args.prefer_ramps ?? DEFAULT_PREFS.preferRamps,
  };

  // Live community reports — the same ones the web map shows.
  const reports = await store.openReports().catch(() => []);
  const { recommended, alternative } = planRoute(start, building, prefs, reports);
  const typical = planRoute(start, building, TYPICAL_PREFS, []).recommended;
  const b = BUILDING_BY_ID.get(building)!;

  if (!recommended) {
    return {
      ok: false,
      reason: "no_accessible_route",
      from: placeName(start),
      to: b.name,
      typical_route_stairs: typical?.stairs ?? null,
    };
  }

  return {
    ok: true,
    from_id: start,
    to_id: building,
    from: placeName(start),
    to: b.name,
    minutes: recommended.minutes,
    meters: Math.round(recommended.meters),
    extra_minutes_vs_typical_maps: typical ? recommended.minutes - typical.minutes : null,
    stairs_on_typical_maps_route: typical?.stairs ?? 0,
    directions: routeLines(recommended),
    verified_segments: `${recommended.verifiedSegments} of ${recommended.totalSegments}`,
    avoiding_reports: recommended.avoided.map((r) => `${CATEGORY[r.category].label} at ${r.locationLabel}`),
    unconfirmed_reports_on_route: recommended.passes.map((r) => `${CATEGORY[r.category].label} at ${r.locationLabel}`),
    alternative: alternative ? { minutes: alternative.minutes, meters: Math.round(alternative.meters) } : null,
  };
}

/** Which edge a report about `place` most plausibly refers to. */
function edgeForReport(place: Place, category: ReportCategory): CampusEdge | null {
  if (place.kind === "feature") return EDGES.find((e) => e.id === place.id) ?? null;

  const entranceIds = place.kind === "entrance" ? [place.id] : BUILDING_BY_ID.get(place.id)?.entrances ?? [];
  const touching = EDGES.filter((e) => entranceIds.includes(e.a) || entranceIds.includes(e.b));

  if (category === "broken_elevator") {
    const elev = EDGES.find((e) => e.elevator && buildingOfEdge(e) === place.building)
      ?? EDGES.find((e) => e.elevator && place.building && e.name?.toLowerCase().includes(place.building.toLowerCase()));
    if (elev) return elev;
  }
  if (category === "blocked_ramp") {
    const ramp = touching.find((e) => e.ramp);
    if (ramp) return ramp;
  }
  if (category === "stairs_path") {
    const stairs = touching.find((e) => e.stairs);
    if (stairs) return stairs;
  }
  // Default: the step-free way in, since that's the one that matters.
  return touching.find((e) => [e.a, e.b].some((id) => NODE_BY_ID.get(id)?.stepFree === true)) ?? touching[0] ?? null;
}

export async function submit_report(
  args: { place: string; category: ReportCategory; note?: string },
  ctx?: ToolContext,
) {
  if (!CATEGORY[args.category]) return { ok: false, reason: "unknown_category" };
  const place = pick(args.place);
  if (!place) return { ok: false, reason: "no_such_place" };
  const edge = edgeForReport(place, args.category);
  if (!edge) return { ok: false, reason: "no_such_place" };

  const a = NODE_BY_ID.get(edge.a)!.pos;
  const b = NODE_BY_ID.get(edge.b)!.pos;
  // Same style as the app's labels, e.g. "Near SSA · north ramp entrance".
  const door = [edge.a, edge.b].map((id) => NODE_BY_ID.get(id)).find((n) => n?.kind === "entrance");
  const short = place.building ? BUILDING_BY_ID.get(place.building)?.short : undefined;
  const label =
    place.kind !== "building" ? place.name
    : edge.name && (edge.ramp || edge.elevator || edge.stairs) ? cap(tidy(edge.name))
    : door && short ? `${short} · ${door.label ?? "entrance"}`
    : place.name;

  const report = await store.insertReport({
    category: args.category,
    edgeId: edge.id,
    lat: (a[0] + b[0]) / 2,
    lng: (a[1] + b[1]) / 2,
    locationLabel: label,
    description: args.note ?? "",
    photoUrl: ctx?.pendingPhotoUrl,
    reporterId: beauUserId(ctx),
  });
  if (ctx?.pendingPhotoUrl) ctx.usedPhoto = true;
  return {
    ok: true,
    report_id: report.id,
    what: CATEGORY[args.category].label,
    where: report.locationLabel,
    status: "unverified",
    has_photo: Boolean(ctx?.pendingPhotoUrl),
    note: "It's on the live map now. Once someone else confirms it, routing treats it as a hard block and everyone is rerouted.",
  };
}

export async function confirm_report({ report_id, agrees }: { report_id: string; agrees: boolean }, ctx?: ToolContext) {
  const r = await store.voteReport(report_id, agrees, beauUserId(ctx));
  if (!r) return { ok: false, reason: "no_such_report" };
  return { ok: true, ...r };
}

/** Watch a route: Beau texts this person if a new report breaks it. */
export async function save_route({ from, to }: { from: string; to: string }, ctx?: ToolContext) {
  if (!ctx?.subscriber) return { ok: false, reason: "not_available_on_this_channel" };
  const f = startNodeFor(from);
  const t = buildingFor(to);
  if (!f || !t) return { ok: false, reason: "unknown_location" };
  await store.updateSubscriber(ctx.subscriber.id, { saved_from: f, saved_to: t, alerts: true });
  ctx.subscriber.saved_from = f;
  ctx.subscriber.saved_to = t;
  ctx.subscriber.alerts = true;
  return { ok: true, watching: `${placeName(f)} → ${placeName(t)}` };
}

export async function set_alerts({ on }: { on: boolean }, ctx?: ToolContext) {
  if (!ctx?.subscriber) return { ok: false, reason: "not_available_on_this_channel" };
  await store.updateSubscriber(ctx.subscriber.id, { alerts: on });
  ctx.subscriber.alerts = on;
  return { ok: true, alerts: on };
}

export const IMPL: Record<string, (args: any, ctx?: ToolContext) => unknown> = {
  resolve_location,
  find_accessible_route,
  submit_report,
  confirm_report,
  save_route,
  set_alerts,
};
