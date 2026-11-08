"use client";

import { useEffect, useMemo, useState } from "react";
import { listReports, onReportsChanged } from "./data";
import { planRoute, type RoutePlan } from "./routing";
import { useApp } from "./settings";
import type { Report } from "./types";

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

export function useRoutePlan(to: string | null): RoutePlan & { loading: boolean; reports: Report[] } {
  const { start, prefs } = useApp();
  const { reports, loading } = useReports();
  const plan = useMemo(() => (to ? planRoute(start.node, to, prefs, reports) : { recommended: null, alternative: null }), [to, start.node, prefs, reports]);
  return { ...plan, loading, reports };
}
