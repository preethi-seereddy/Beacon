/**
 * Accessible routing on the campus graph with Dijkstra's algorithm.
 *
 * Edge cost = walking distance × multipliers from the user's preferences and from
 * community reports. Hard constraints (stairs for step-free users, confirmed
 * obstacles) make an edge impassable.
 */
import { BUILDING_BY_ID, EDGES, NODE_BY_ID, NODES } from "./campus";
import { bearing, compass, distanceM, pointToSegmentM } from "./geo";
import { reportStatus } from "./status";
import type { CampusEdge, LatLng, PlannedRoute, Preferences, Report, RouteStep } from "./types";

/** Average manual-wheelchair travel speed, meters per minute (~1.1 m/s). */
const SPEED_M_PER_MIN = 66;

interface Adj {
  to: string;
  edge: CampusEdge;
  meters: number;
}

const ADJ: Map<string, Adj[]> = (() => {
  const m = new Map<string, Adj[]>();
  for (const n of NODES) m.set(n.id, []);
  for (const e of EDGES) {
    const a = NODE_BY_ID.get(e.a);
    const b = NODE_BY_ID.get(e.b);
    if (!a || !b) throw new Error(`Edge ${e.id} references a missing node`);
    const meters = distanceM(a.pos, b.pos);
    m.get(e.a)!.push({ to: e.b, edge: e, meters });
    m.get(e.b)!.push({ to: e.a, edge: e, meters });
  }
  return m;
})();

type Effect = { block: boolean; factor: number };

/** How each report affects the edge it sits on. */
export function reportEffects(reports: Report[]): Map<string, { effect: Effect; reports: Report[] }> {
  const out = new Map<string, { effect: Effect; reports: Report[] }>();
  for (const r of reports) {
    if (!r.edgeId) continue;
    const s = reportStatus(r);
    let eff: Effect;
    if (s === "resolved") continue;
    else if (s === "confirmed") eff = { block: true, factor: 1 };
    else if (s === "unverified") eff = { block: false, factor: 4 };
    else eff = { block: false, factor: 1.6 }; // disputed
    const cur = out.get(r.edgeId);
    if (!cur) out.set(r.edgeId, { effect: eff, reports: [r] });
    else {
      cur.effect = { block: cur.effect.block || eff.block, factor: Math.max(cur.effect.factor, eff.factor) };
      cur.reports.push(r);
    }
  }
  return out;
}

function edgeCost(a: Adj, prefs: Preferences, effects: ReturnType<typeof reportEffects> | null, extra?: Map<string, number>): number {
  const e = a.edge;
  if (e.stairs && (prefs.stepFree || prefs.avoidStairs)) return Infinity;
  let c = a.meters;
  if (e.elevator && prefs.avoidElevators) c *= 5;
  if (e.ramp && prefs.preferRamps) c *= 0.8;
  if (!e.verified) c *= 1.25;
  const eff = effects?.get(e.id)?.effect;
  if (eff?.block) return Infinity;
  if (eff) c *= eff.factor;
  const x = extra?.get(e.id);
  if (x) c *= x;
  return c;
}

interface SearchResult {
  dist: Map<string, number>;
  prev: Map<string, { node: string; edge: CampusEdge }>;
}

export function dijkstra(start: string, prefs: Preferences, effects: ReturnType<typeof reportEffects> | null, extra?: Map<string, number>): SearchResult {
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; edge: CampusEdge }>();
  const done = new Set<string>();
  for (const n of NODES) dist.set(n.id, Infinity);
  dist.set(start, 0);

  // The graph is small (dozens of nodes), so a linear scan for the minimum is fine.
  for (;;) {
    let u: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!done.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null) break;
    done.add(u);
    for (const a of ADJ.get(u) ?? []) {
      if (done.has(a.to)) continue;
      const nd = best + edgeCost(a, prefs, effects, extra);
      if (nd < dist.get(a.to)!) {
        dist.set(a.to, nd);
        prev.set(a.to, { node: u, edge: a.edge });
      }
    }
  }
  return { dist, prev };
}

function pathTo(res: SearchResult, start: string, target: string): { nodes: string[]; edges: CampusEdge[] } | null {
  if (!Number.isFinite(res.dist.get(target))) return null;
  const nodes = [target];
  const edges: CampusEdge[] = [];
  let cur = target;
  while (cur !== start) {
    const p = res.prev.get(cur);
    if (!p) return null;
    edges.unshift(p.edge);
    nodes.unshift(p.node);
    cur = p.node;
  }
  return { nodes, edges };
}

/** Pick the building entrance with the lowest cost that satisfies preferences. */
function bestEntrance(res: SearchResult, buildingId: string, prefs: Preferences): string | null {
  const b = BUILDING_BY_ID.get(buildingId);
  if (!b) return null;
  let best: string | null = null;
  let bestD = Infinity;
  for (const id of b.entrances) {
    const n = NODE_BY_ID.get(id);
    if (!n) continue;
    if (prefs.stepFree && n.stepFree === false) continue;
    const d = res.dist.get(id) ?? Infinity;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

function turnWord(delta: number): "left" | "right" | null {
  const d = ((delta + 540) % 360) - 180;
  if (Math.abs(d) > 160) return d > 0 ? "right" : "left";
  if (d > 35) return "right";
  if (d < -35) return "left";
  return null;
}

function buildSteps(nodes: string[], edges: CampusEdge[], buildingId: string, effects: ReturnType<typeof reportEffects> | null): RouteStep[] {
  const steps: RouteStep[] = [];
  let prevBearing: number | null = null;
  let acc = 0;
  for (let i = 0; i < edges.length; i++) {
    const a = NODE_BY_ID.get(nodes[i])!.pos;
    const b = NODE_BY_ID.get(nodes[i + 1])!.pos;
    const e = edges[i];
    const br = bearing(a, b);
    const m = distanceM(a, b);
    const where = e.name ? ` on ${e.name}` : "";
    const turn = prevBearing === null ? null : turnWord(br - prevBearing);

    if (e.elevator) {
      steps.push({ icon: "elevator", text: `Take ${e.name ?? "the elevator"}`, detail: e.verified ? "Working at last check" : "Not recently verified" });
    } else if (e.ramp) {
      steps.push({ icon: "ramp", text: `Use ${e.name ?? "the ramp"}${turn ? ` on your ${turn}` : ""}`, detail: e.verified ? "Gentle slope · verified" : "Ramp not recently verified" });
    } else if (prevBearing === null) {
      steps.push({ icon: "up", text: `Head ${compass(br)}${where}`, detail: `${Math.round(m * 3.28)} ft` });
      acc = m;
    } else if (turn) {
      steps.push({ icon: turn, text: `Turn ${turn}${where}`, detail: `${Math.round(m * 3.28)} ft` });
      acc = m;
    } else {
      const last = steps[steps.length - 1];
      if (last && (last.icon === "up" || last.icon === "left" || last.icon === "right")) {
        acc += m;
        last.detail = `${Math.round(acc * 3.28)} ft`;
      } else {
        steps.push({ icon: "up", text: `Continue ${compass(br)}${where}`, detail: `${Math.round(m * 3.28)} ft` });
        acc = m;
      }
    }
    const eff = effects?.get(e.id);
    if (eff && !eff.effect.block) {
      steps.push({ icon: "warn", text: "Reported issue on this stretch", detail: "Not confirmed yet — take care" });
    }
    if (!e.verified && !e.ramp && !e.elevator) {
      const last = steps[steps.length - 1];
      last.detail = `${last.detail ?? ""}${last.detail ? " · " : ""}last checked ${e.lastChecked ?? "a while ago"}`;
    }
    prevBearing = br;
  }
  const end = NODE_BY_ID.get(nodes[nodes.length - 1])!;
  const bld = BUILDING_BY_ID.get(buildingId);
  steps.push({ icon: "door", text: `Arrive at ${bld?.short ?? "destination"} ${end.label ?? "entrance"}`, detail: end.stepFree === false ? "Entrance has steps" : "Step-free entrance" });
  return steps;
}

function summarize(
  nodes: string[],
  edges: CampusEdge[],
  buildingId: string,
  effects: ReturnType<typeof reportEffects> | null,
  avoided: Report[],
): PlannedRoute {
  const coords: LatLng[] = nodes.map((id) => NODE_BY_ID.get(id)!.pos);
  let meters = 0;
  for (let i = 1; i < coords.length; i++) meters += distanceM(coords[i - 1], coords[i]);
  const passes = edges.flatMap((e) => effects?.get(e.id)?.reports ?? []);
  return {
    nodeIds: nodes,
    edgeIds: edges.map((e) => e.id),
    coords,
    meters,
    minutes: Math.max(1, Math.round(meters / SPEED_M_PER_MIN)),
    ramps: edges.filter((e) => e.ramp).length,
    elevators: edges.filter((e) => e.elevator).length,
    stairs: edges.filter((e) => e.stairs).length,
    verifiedSegments: edges.filter((e) => e.verified && !effects?.has(e.id)).length,
    totalSegments: edges.length,
    avoided,
    passes,
    steps: buildSteps(nodes, edges, buildingId, effects),
  };
}

export interface RoutePlan {
  recommended: PlannedRoute | null;
  alternative: PlannedRoute | null;
}

export function planRoute(startNode: string, buildingId: string, prefs: Preferences, reports: Report[]): RoutePlan {
  const effects = reportEffects(reports);
  const res = dijkstra(startNode, prefs, effects);
  const target = bestEntrance(res, buildingId, prefs);
  if (!target) return { recommended: null, alternative: null };
  const p = pathTo(res, startNode, target);
  if (!p) return { recommended: null, alternative: null };

  // What would we have done without community reports? Anything on that path that we
  // now avoid is shown to the user as "rerouted around…".
  const naive = dijkstra(startNode, prefs, null);
  const naiveTarget = bestEntrance(naive, buildingId, prefs);
  const naivePath = naiveTarget ? pathTo(naive, startNode, naiveTarget) : null;
  const used = new Set(p.edges.map((e) => e.id));
  const avoided = (naivePath?.edges ?? []).filter((e) => !used.has(e.id)).flatMap((e) => effects.get(e.id)?.reports ?? []);

  const recommended = summarize(p.nodes, p.edges, buildingId, effects, avoided);

  // Alternative: penalize the recommended route's edges and search again.
  const penalty = new Map(p.edges.map((e) => [e.id, 3] as [string, number]));
  const res2 = dijkstra(startNode, prefs, effects, penalty);
  const t2 = bestEntrance(res2, buildingId, prefs);
  const p2 = t2 ? pathTo(res2, startNode, t2) : null;
  const alternative = p2 && p2.edges.map((e) => e.id).join() !== p.edges.map((e) => e.id).join() ? summarize(p2.nodes, p2.edges, buildingId, effects, []) : null;

  return { recommended, alternative };
}

export function nearestNode(pos: LatLng): { id: string; meters: number } {
  let best = NODES[0].id;
  let bestD = Infinity;
  for (const n of NODES) {
    const d = distanceM(pos, n.pos);
    if (d < bestD) {
      bestD = d;
      best = n.id;
    }
  }
  return { id: best, meters: bestD };
}

/** Snap a reported location to the nearest walkway so routing can avoid it. */
export function nearestEdge(pos: LatLng): { edge: CampusEdge; meters: number } {
  let best = EDGES[0];
  let bestD = Infinity;
  for (const e of EDGES) {
    const d = pointToSegmentM(pos, NODE_BY_ID.get(e.a)!.pos, NODE_BY_ID.get(e.b)!.pos);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return { edge: best, meters: bestD };
}
