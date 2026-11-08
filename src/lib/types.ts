export type LatLng = [number, number];

export type NodeKind = "junction" | "entrance";

export interface CampusNode {
  id: string;
  pos: LatLng;
  kind: NodeKind;
  /** Building id for entrances. */
  building?: string;
  label?: string;
  /** True when this entrance has no step (level or ramped, power door etc). */
  stepFree?: boolean;
}

export interface CampusEdge {
  id: string;
  a: string;
  b: string;
  /** Human label used in directions, e.g. "the Mall". */
  name?: string;
  stairs?: boolean;
  ramp?: boolean;
  elevator?: boolean;
  /** Has this segment been checked by the community recently? */
  verified: boolean;
  /** When it was last checked, for display. */
  lastChecked?: string;
}

export interface Building {
  id: string;
  name: string;
  short: string;
  center: LatLng;
  /** Footprint polygon used for the neon building outlines on the map. */
  footprint: LatLng[];
  accent: "mint" | "pink" | "yellow" | "blue";
  /** Height in "floors" — used to fake extrusion in 3D view. */
  floors: number;
  entrances: string[];
}

export interface Preferences {
  stepFree: boolean;
  avoidStairs: boolean;
  avoidElevators: boolean;
  preferRamps: boolean;
}

export type ReportCategory =
  | "broken_elevator"
  | "blocked_ramp"
  | "stairs_path"
  | "construction"
  | "blocked_entrance"
  | "other";

export type ReportStatus = "unverified" | "confirmed" | "disputed" | "resolved";

export interface Report {
  id: string;
  category: ReportCategory;
  lat: number;
  lng: number;
  /** Nearest graph edge — routing uses this to avoid the obstacle. */
  edgeId: string | null;
  locationLabel: string;
  description: string;
  photoUrl: string | null;
  createdAt: string;
  resolvedAt: string | null;
  confirmations: number;
  disputes: number;
  /** Local voter's own vote, if any. */
  myVote?: "confirm" | "dispute" | null;
}

export interface NewReport {
  category: ReportCategory;
  lat: number;
  lng: number;
  locationLabel: string;
  description: string;
  photo?: File | null;
}

export interface RouteStep {
  icon: "up" | "left" | "right" | "ramp" | "elevator" | "door" | "warn";
  text: string;
  detail?: string;
}

export interface PlannedRoute {
  nodeIds: string[];
  edgeIds: string[];
  coords: LatLng[];
  meters: number;
  minutes: number;
  ramps: number;
  elevators: number;
  stairs: number;
  verifiedSegments: number;
  totalSegments: number;
  /** Reports along or avoided by this route. */
  avoided: Report[];
  passes: Report[];
  steps: RouteStep[];
}
