"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CAMPUS_CENTER, DEMO_START } from "./campus";
import { saveDisplayName } from "./data";
import { distanceM } from "./geo";
import { nearestNode } from "./routing";
import type { LatLng, Preferences } from "./types";

export interface Display {
  clarity: boolean;
  reduceMotion: boolean;
  beauAnimations: boolean;
  highContrastMap: boolean;
  textSize: number; // 1..5, 3 = default
  bigTargets: boolean;
  map3d: boolean;
}

export interface RecentRoute {
  from: string; // node id
  fromLabel: string;
  to: string; // building id
  minutes: number;
  at: string;
}

interface State {
  prefs: Preferences;
  display: Display;
  favorites: string[];
  recent: RecentRoute[];
  beauMemory: boolean;
  name: string;
  mobility: string;
}

const DEFAULT: State = {
  prefs: { stepFree: true, avoidStairs: true, avoidElevators: false, preferRamps: true },
  display: { clarity: false, reduceMotion: false, beauAnimations: true, highContrastMap: false, textSize: 3, bigTargets: false, map3d: true },
  favorites: ["ECSW", "LIB"],
  recent: [],
  beauMemory: false,
  name: "Jordan Lee",
  mobility: "Manual wheelchair",
};

const KEY = "beacon:settings:v1";

interface Ctx extends State {
  ready: boolean;
  setPrefs: (p: Partial<Preferences>) => void;
  setDisplay: (d: Partial<Display>) => void;
  toggleFavorite: (buildingId: string) => void;
  addRecent: (r: Omit<RecentRoute, "at">) => void;
  setProfile: (p: Partial<Pick<State, "name" | "mobility" | "beauMemory">>) => void;
  /** Where routes start: the user's location snapped to the walkway graph, or a demo start. */
  start: { node: string; label: string; pos: LatLng | null; live: boolean };
  locate: () => void;
  motionOK: boolean;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [start, setStart] = useState<Ctx["start"]>({ node: DEMO_START, label: "Visitor Center (demo start)", pos: null, live: false });
  const [sysReduce, setSysReduce] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<State>;
        setState((s) => ({ ...s, ...saved, prefs: { ...s.prefs, ...saved.prefs }, display: { ...s.display, ...saved.display } }));
      }
    } catch {
      /* ignore */
    }
    setReady(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSysReduce(mq.matches);
    const on = () => setSysReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, ready]);

  // Keep the leaderboard name in sync (debounced while typing).
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void saveDisplayName(state.name).catch(() => undefined), 800);
    return () => clearTimeout(t);
  }, [state.name, ready]);

  // Apply display settings to <html> so CSS can react.
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.clarity = String(state.display.clarity);
    el.dataset.reduceMotion = String(state.display.reduceMotion || sysReduce);
    el.dataset.bigTargets = String(state.display.bigTargets);
    el.dataset.beau = String(state.display.beauAnimations);
    el.style.fontSize = `${[14, 15, 16, 17.5, 19][state.display.textSize - 1] ?? 16}px`;
  }, [state.display, sysReduce]);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos: LatLng = [p.coords.latitude, p.coords.longitude];
        // Only use live location when the user is actually on campus.
        if (distanceM(pos, CAMPUS_CENTER) > 1500) return;
        const n = nearestNode(pos);
        setStart({ node: n.id, label: "Current location", pos, live: true });
      },
      () => {
        /* denied or unavailable — keep demo start */
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      ready,
      start,
      locate,
      motionOK: !(state.display.reduceMotion || sysReduce || state.display.clarity),
      setPrefs: (p) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
      setDisplay: (d) => setState((s) => ({ ...s, display: { ...s.display, ...d } })),
      toggleFavorite: (id) => setState((s) => ({ ...s, favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id] })),
      addRecent: (r) =>
        setState((s) => ({
          ...s,
          recent: [{ ...r, at: new Date().toISOString() }, ...s.recent.filter((x) => !(x.to === r.to && x.from === r.from))].slice(0, 6),
        })),
      setProfile: (p) => setState((s) => ({ ...s, ...p })),
    }),
    [state, ready, start, locate, sysReduce],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside <AppProvider>");
  return c;
}

export function prefsSummary(p: Preferences): string[] {
  const out: string[] = [];
  if (p.stepFree) out.push("Step-free");
  if (p.avoidStairs && !p.stepFree) out.push("No stairs");
  else if (p.avoidStairs) out.push("No stairs");
  if (p.preferRamps) out.push("Ramps");
  if (p.avoidElevators) out.push("No elevators");
  return out;
}
