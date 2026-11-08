/**
 * Campus graph for routing.
 *
 * IMPORTANT: coordinates here are an approximate demo network around UT Dallas.
 * Before demoing, open /map?debug=1, click real walkways/entrances on the map,
 * and paste the copied coordinates back into this file.
 */
import type { Building, CampusEdge, CampusNode, LatLng } from "./types";

export const CAMPUS_CENTER: LatLng = [32.9862, -96.7493];
export const CAMPUS_BOUNDS: [LatLng, LatLng] = [
  [32.982, -96.7545],
  [32.9905, -96.7445],
];

const J = (id: string, lat: number, lng: number): CampusNode => ({ id, pos: [lat, lng], kind: "junction" });
const E = (id: string, building: string, label: string, lat: number, lng: number, stepFree = true): CampusNode => ({
  id,
  pos: [lat, lng],
  kind: "entrance",
  building,
  label,
  stepFree,
});

export const NODES: CampusNode[] = [
  J("J1", 32.9877, -96.751),
  J("J2", 32.9877, -96.7495),
  J("J3", 32.9877, -96.7484),
  J("J4", 32.9877, -96.747),
  J("J5", 32.986, -96.7525),
  J("J6", 32.986, -96.751),
  J("J7", 32.986, -96.7495),
  J("J8", 32.986, -96.7484),
  J("J9", 32.986, -96.747),
  J("J10", 32.9845, -96.75),
  J("J11", 32.9845, -96.7484),
  J("J12", 32.9845, -96.747),
  J("J13", 32.9835, -96.7493),

  E("ECSN_S", "ECSN", "south entrance", 32.9883, -96.7502),
  E("ECSS_S", "ECSS", "south entrance", 32.9863, -96.7503),
  E("ECSW_W", "ECSW", "west power door", 32.98625, -96.75222),
  E("ECSW_E", "ECSW", "east entrance (steps)", 32.986, -96.7515, false),
  E("ATC_S", "ATC", "south entrance", 32.9866, -96.7518),
  E("SU_N", "SU", "north entrance", 32.9875, -96.74895),
  E("SU_S", "SU", "south entrance", 32.98665, -96.74895),
  E("LIB_W", "LIB", "west entrance", 32.98715, -96.7481),
  E("SSA_N", "SSA", "north ramp entrance", 32.9856, -96.74955),
  E("SSA_S", "SSA", "south entrance", 32.9849, -96.7498),
  E("ACT_E", "ACT", "east entrance", 32.9853, -96.74845),
  E("JSOM_N", "JSOM", "north entrance", 32.98545, -96.747),
  E("VC_N", "VC", "north entrance", 32.98345, -96.7493),
];

const edge = (a: string, b: string, extra: Partial<CampusEdge> = {}): CampusEdge => ({
  id: extra.id ?? `${a}|${b}`,
  a,
  b,
  verified: true,
  ...extra,
});

export const EDGES: CampusEdge[] = [
  // north row
  edge("J1", "J2", { name: "Northside Walk", verified: false, lastChecked: "6 days ago" }),
  edge("J2", "J3", { name: "Northside Walk" }),
  edge("J3", "J4", { name: "Library Walk" }),
  // central row
  edge("J5", "J6", { name: "Rutford Walk" }),
  edge("J6", "J7", { name: "Central Walk" }),
  edge("J7", "J8", { name: "Central Walk" }),
  edge("J8", "J9", { name: "Central Walk" }),
  // south row
  edge("J10", "J11", { name: "South Walk", ramp: true }),
  edge("J11", "J12", { name: "South Walk" }),
  // verticals
  edge("J1", "J6", { name: "West Walk" }),
  edge("J2", "J7", { name: "Engineering Walk" }),
  edge("J3", "J8", { name: "the Mall" }),
  edge("J8", "J11", { name: "the Mall" }),
  edge("J4", "J9", { name: "East Walk" }),
  edge("J7", "J10", { name: "Engineering Walk" }),
  edge("J10", "J13", { name: "Visitor Path", verified: false, lastChecked: "3 days ago" }),
  edge("J11", "J13", { name: "Visitor Path" }),
  // features that matter for accessibility
  edge("J7", "J3", { name: "the Plaza steps", stairs: true }),
  edge("J9", "J12", { name: "the JSOM east steps", stairs: true }),
  edge("J9", "J12", { id: "JSOM_ELEV", name: "the JSOM east elevator", elevator: true }),
  // entrances
  edge("ECSN_S", "J1"),
  edge("ECSN_S", "J2"),
  edge("ECSS_S", "J6"),
  edge("ECSS_S", "J7"),
  edge("ECSW_W", "J5"),
  edge("ECSW_E", "J6", { stairs: true }),
  edge("ATC_S", "J6", { ramp: true }),
  edge("ATC_S", "J5"),
  edge("SU_N", "J2"),
  edge("SU_N", "J3"),
  edge("SU_S", "J8"),
  edge("LIB_W", "J3"),
  edge("SSA_N", "J7", { ramp: true, name: "the SSA north ramp" }),
  edge("SSA_S", "J10"),
  edge("ACT_E", "J8", { ramp: true }),
  edge("ACT_E", "J11"),
  edge("JSOM_N", "J9"),
  edge("JSOM_N", "J12"),
  edge("VC_N", "J13"),
];

function rect(center: LatLng, hLat: number, hLng: number): LatLng[] {
  const [la, ln] = center;
  return [
    [la + hLat, ln - hLng],
    [la + hLat, ln + hLng],
    [la - hLat, ln + hLng],
    [la - hLat, ln - hLng],
  ];
}

export const BUILDINGS: Building[] = [
  { id: "ECSW", short: "ECSW", name: "Engineering & Computer Science West", center: [32.986, -96.7519], footprint: rect([32.986, -96.7519], 0.00026, 0.0003), accent: "mint", floors: 5, entrances: ["ECSW_W", "ECSW_E"] },
  { id: "ECSS", short: "ECSS", name: "Engineering & Computer Science South", center: [32.9867, -96.7503], footprint: rect([32.9867, -96.7503], 0.00024, 0.00034), accent: "blue", floors: 4, entrances: ["ECSS_S"] },
  { id: "ECSN", short: "ECSN", name: "Engineering & Computer Science North", center: [32.98865, -96.7502], footprint: rect([32.98865, -96.7502], 0.0002, 0.0004), accent: "blue", floors: 4, entrances: ["ECSN_S"] },
  { id: "ATC", short: "ATC", name: "Arts & Technology", center: [32.9869, -96.7518], footprint: rect([32.9869, -96.7518], 0.00018, 0.00026), accent: "yellow", floors: 3, entrances: ["ATC_S"] },
  { id: "SU", short: "Student Union", name: "Student Union", center: [32.98705, -96.74895], footprint: rect([32.98705, -96.74895], 0.00028, 0.0003), accent: "pink", floors: 3, entrances: ["SU_N", "SU_S"] },
  { id: "LIB", short: "Library", name: "McDermott Library", center: [32.98715, -96.7476], footprint: rect([32.98715, -96.7476], 0.00028, 0.00036), accent: "yellow", floors: 5, entrances: ["LIB_W"] },
  { id: "SSA", short: "SSA", name: "Student Services Building", center: [32.9852, -96.74955], footprint: rect([32.9852, -96.74955], 0.0002, 0.00022), accent: "pink", floors: 3, entrances: ["SSA_N", "SSA_S"] },
  { id: "ACT", short: "Activity Ctr", name: "Activity Center", center: [32.9853, -96.7488], footprint: rect([32.9853, -96.7488], 0.00018, 0.00022), accent: "blue", floors: 2, entrances: ["ACT_E"] },
  { id: "JSOM", short: "JSOM", name: "Naveen Jindal School of Management", center: [32.98505, -96.747], footprint: rect([32.98505, -96.747], 0.00026, 0.00036), accent: "blue", floors: 4, entrances: ["JSOM_N"] },
  { id: "VC", short: "Visitor Ctr", name: "Visitor Center", center: [32.9832, -96.7493], footprint: rect([32.9832, -96.7493], 0.00016, 0.00024), accent: "pink", floors: 2, entrances: ["VC_N"] },
];

export const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));
export const EDGE_BY_ID = new Map(EDGES.map((e) => [e.id, e]));
export const BUILDING_BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

/** Where we start when location is unavailable. */
export const DEMO_START = "VC_N";

/** Extra words people actually type for each building. */
const ALIASES: Record<string, string[]> = {
  ECSW: ["engineering west", "ecs west", "computer science"],
  ECSS: ["engineering south", "ecs south"],
  ECSN: ["engineering north", "ecs north"],
  ATC: ["arts technology", "atec", "arts and technology"],
  SU: ["union", "student union", "food"],
  LIB: ["mcdermott", "library", "mc"],
  SSA: ["student services", "advising", "financial aid"],
  ACT: ["activity center", "gym", "rec"],
  JSOM: ["jindal", "management", "business", "som"],
  VC: ["visitor", "visitor center", "parking"],
};

function haystack(b: Building): string[] {
  return [b.short, b.id, b.name, ...(ALIASES[b.id] ?? [])].map((x) => x.toLowerCase());
}

/** How well a building matches the query: lower is better, Infinity = no match. */
function matchScore(b: Building, q: string): number {
  let best = Infinity;
  for (const h of haystack(b)) {
    if (h === q) best = Math.min(best, 0);
    else if (h.startsWith(q)) best = Math.min(best, 1);
    else if (h.split(/[\s&·-]+/).some((w) => w.startsWith(q))) best = Math.min(best, 2);
    else if (h.includes(q)) best = Math.min(best, 3);
  }
  return best;
}

export function buildingSearch(q: string): Building[] {
  const s = q.trim().toLowerCase();
  if (!s) return BUILDINGS;
  return BUILDINGS.filter((b) => matchScore(b, s) < Infinity);
}

/**
 * Type-ahead suggestions: best text match first, nearest first among equals.
 * With an empty query, returns the closest places ("nearby").
 */
export function suggestBuildings(q: string, from: LatLng, limit = 5): { building: Building; meters: number }[] {
  const s = q.trim().toLowerCase();
  const dist = (b: Building) => {
    const dLat = (b.center[0] - from[0]) * 110540;
    const dLng = (b.center[1] - from[1]) * 111320 * Math.cos((from[0] * Math.PI) / 180);
    return Math.hypot(dLat, dLng);
  };
  return BUILDINGS.map((b) => ({ building: b, meters: dist(b), score: s ? matchScore(b, s) : 0 }))
    .filter((x) => x.score < Infinity)
    .sort((a, b) => a.score - b.score || a.meters - b.meters)
    .slice(0, limit)
    .map(({ building, meters }) => ({ building, meters }));
}
