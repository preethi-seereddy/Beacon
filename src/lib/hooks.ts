"use client";

import { useEffect, useMemo, useState } from "react";
import { getLeaderboard, listReports, onReportsChanged } from "./data";
import { planRoute, type RoutePlan } from "./routing";
import { useApp } from "./settings";
import { BUILDING_BY_ID, NODE_BY_ID } from "./campus";
import type { LatLng, LeaderRow, Report } from "./types";

export function useReports(): { reports: Report[]; loading: boolean; error: string | null; reload: () => void } {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => onReportsChanged(() => setTick((t) => t + 1)), []);

  useEffect(() => {
    let alive = true;
    listReports()
      .then((r) => alive && (setReports(r), setError(null)))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Could not load reports"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  return { reports, loading, error, reload: () => setTick((t) => t + 1) };
}

/** Where a route starts: the user's location, or a chosen building's step-free entrance. */
export interface RouteStart {
  node: string;
  label: string;
  /** Live GPS position (only for "current location"). */
  pos: LatLng | null;
  /** Building id when the user picked a building as the start. */
  building: string | null;
}

export function useRouteStart(fromBuilding: string | null): RouteStart {
  const { start } = useApp();
  const b = fromBuilding ? BUILDING_BY_ID.get(fromBuilding) : undefined;
  if (!b) return { node: start.node, label: start.label, pos: start.pos, building: null };
  const entrance = b.entrances.find((id) => NODE_BY_ID.get(id)?.stepFree !== false) ?? b.entrances[0];
  return { node: entrance, label: b.short === b.name ? b.name : `${b.short} · ${b.name}`, pos: null, building: b.id };
}

export function useRoutePlan(to: string | null, fromBuilding: string | null = null): RoutePlan & { loading: boolean; reports: Report[]; start: RouteStart } {
  const { prefs } = useApp();
  const start = useRouteStart(fromBuilding);
  const { reports, loading } = useReports();
  const plan = useMemo(
    () => (to && to !== start.building ? planRoute(start.node, to, prefs, reports) : { recommended: null, alternative: null }),
    [to, start.node, start.building, prefs, reports],
  );
  return { ...plan, loading, reports, start };
}

export function useLeaderboard(): { rows: LeaderRow[]; loading: boolean; error: string | null } {
  const { name, ready } = useApp();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => onReportsChanged(() => setTick((t) => t + 1)), []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    getLeaderboard(name)
      .then((r) => alive && (setRows(r), setError(null)))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Could not load the leaderboard"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick, name, ready]);

  return { rows, loading, error };
}
