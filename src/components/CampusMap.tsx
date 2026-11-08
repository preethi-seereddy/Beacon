"use client";

/**
 * Campus map in real 3D (MapLibre GL + OpenStreetMap vector tiles from OpenFreeMap).
 *
 * - Buildings are extruded from OpenStreetMap's own footprints and heights, so they
 *   line up with the real campus. The destination building glows mint.
 * - 3D mode tilts and rotates the camera; you can still pan, zoom and rotate
 *   (two-finger twist on phones, right-drag or Ctrl+drag on desktop).
 * - If the vector tiles can't load, it falls back to OSM raster tiles plus
 *   Beacon's own building outlines, so the map never goes blank.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import { LngLatBounds, Map as MLMap, Marker, Popup, type GeoJSONSource } from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { BUILDINGS, BUILDING_BY_ID, CAMPUS_CENTER, EDGES, NODES, NODE_BY_ID } from "@/lib/campus";
import { CATEGORY, reportStatus } from "@/lib/status";
import type { LatLng, PlannedRoute, Report } from "@/lib/types";
import { iconSvg } from "./Icon";

export interface CampusMapProps {
  route?: PlannedRoute | null;
  alt?: PlannedRoute | null;
  reports?: Report[];
  destination?: string | null;
  you?: LatLng | null;
  tilt?: boolean;
  interactive?: boolean;
  highContrast?: boolean;
  animate?: boolean;
  /** Report mode: tap the map to choose a location. */
  onPick?: (pos: LatLng) => void;
  picked?: LatLng | null;
  /** Center on a point instead of fitting the route. */
  focus?: LatLng | null;
  zoom?: number;
  debug?: boolean;
  className?: string;
  /** Space kept clear around the route when fitting (e.g. for the bottom sheet). */
  padding?: { top: number; bottom: number; left: number; right: number };
}

type Json = any;

const ll = (p: LatLng): [number, number] => [p[1], p[0]];
const fc = (features: Json[]): Json => ({ type: "FeatureCollection", features });
const line = (coords: LatLng[]): Json => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords.map(ll) } });
const poly = (ring: LatLng[], props: Json = {}): Json => ({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]].map(ll)] } });

const TILT = { pitch: 62, bearing: -28 };
const FLAT = { pitch: 0, bearing: 0 };

const ACCENT: Record<string, string> = { mint: "#3DE3A6", pink: "#F48FC0", yellow: "#E7DD6A", blue: "#8AA2EE" };

/** Dark neon style built on OpenFreeMap's free OpenStreetMap vector tiles. */
function vectorStyle(hc: boolean): Json {
  const text = hc ? "#FFFFFF" : "#DDE4FF";
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      omt: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: '© <a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": hc ? "#000000" : "#0A1124" } },
      { id: "landcover", type: "fill", source: "omt", "source-layer": "landcover", paint: { "fill-color": "#0D2622", "fill-opacity": 0.55 } },
      { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": "#0F2E27", "fill-opacity": 0.7 } },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": "#0B1F3D" } },
      {
        id: "roads",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["!=", ["get", "class"], "path"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": hc ? "#7A86B8" : "#24335F", "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 18, 12] },
      },
      {
        id: "paths",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["==", ["get", "class"], "path"],
        layout: { "line-cap": "round" },
        paint: { "line-color": hc ? "#C9A3FF" : "#4B3C7A", "line-width": ["interpolate", ["linear"], ["zoom"], 15, 0.8, 19, 4], "line-dasharray": [1.5, 1.5] },
      },
      {
        id: "bldg-outline",
        type: "line",
        source: "omt",
        "source-layer": "building",
        minzoom: 15,
        paint: { "line-color": "#8AA2EE", "line-opacity": hc ? 0.9 : 0.4, "line-width": 1.2 },
      },
      {
        id: "bldg-3d",
        type: "fill-extrusion",
        source: "omt",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 10], 0, "#1C2752", 15, "#28386E", 30, "#35498F", 60, "#4D63B8"],
          "fill-extrusion-height": ["max", ["coalesce", ["get", "render_height"], 0], 12],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.93,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      {
        id: "road-labels",
        type: "symbol",
        source: "omt",
        "source-layer": "transportation_name",
        minzoom: 15,
        layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11, "symbol-placement": "line" },
        paint: { "text-color": hc ? "#FFFFFF" : "#8A96BE", "text-halo-color": "#0A1124", "text-halo-width": 1.4 },
      },
      {
        id: "poi-labels",
        type: "symbol",
        source: "omt",
        "source-layer": "poi",
        minzoom: 16,
        filter: ["has", "name"],
        layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 11.5, "text-max-width": 9, "text-allow-overlap": false },
        paint: { "text-color": text, "text-halo-color": "#0A1124", "text-halo-width": 1.6 },
      },
    ],
  };
}

/** Used only if the vector tiles fail: raster OSM + Beacon's own extruded outlines. */
function fallbackStyle(): Json {
  return {
    version: 8,
    sources: {
      osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
      campus: { type: "geojson", data: fc(BUILDINGS.map((b) => poly(b.footprint, { h: b.floors * 4.5, c: ACCENT[b.accent] }))) },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0A1124" } },
      { id: "osm", type: "raster", source: "osm", paint: { "raster-brightness-max": 0.38, "raster-saturation": -0.7, "raster-contrast": 0.1 } },
      {
        id: "bldg-3d",
        type: "fill-extrusion",
        source: "campus",
        paint: { "fill-extrusion-color": "#2A3A72", "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.93, "fill-extrusion-vertical-gradient": true },
      },
      { id: "bldg-outline", type: "line", source: "campus", paint: { "line-color": ["get", "c"], "line-width": 1.5 } },
    ],
  };
}

function el(html: string, className = ""): HTMLDivElement {
  const d = document.createElement("div");
  d.className = className;
  d.innerHTML = html;
  return d;
}

function reportEl(r: Report): HTMLDivElement {
  const s = reportStatus(r);
  const c = s === "unverified" ? "#E7DD6A" : s === "resolved" ? "#8AA2EE" : "#F48FC0";
  const bg = s === "unverified" ? "#26240F" : s === "resolved" ? "#121A36" : "#2E1530";
  const d = el(
    `<div class="bx-marker" style="--c:${c};--bgc:${bg}">${iconSvg(CATEGORY[r.category].icon)}</div><div class="bx-stem" style="background:${c}"></div>`,
    "bx-pinwrap",
  );
  d.setAttribute("role", "button");
  d.setAttribute("tabindex", "0");
  d.setAttribute("aria-label", `${CATEGORY[r.category].label} — ${r.locationLabel}. Open report.`);
  return d;
}

const pinEl = (color: string, label: string) => {
  const d = el(
    `<svg width="36" height="44" viewBox="0 0 28 34" aria-hidden="true"><path d="M14 33C5 22 1 16 1 11a13 13 0 0 1 26 0c0 5-4 11-13 22z" fill="${color}" stroke="#06130F" stroke-width="2"/><circle cx="14" cy="11" r="4.5" fill="#06130F"/></svg>`,
    "bx-pin",
  );
  d.setAttribute("aria-label", label);
  return d;
};

function addOverlayLayers(map: MLMap, debug: boolean) {
  const add = (layer: Json, before?: string) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer, before);
  };
  const src = (id: string, data: Json) => {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data } as Json);
  };
  src("dest-bldg", fc([]));
  src("alt", fc([]));
  src("route", fc([]));

  add({ id: "dest-3d", type: "fill-extrusion", source: "dest-bldg", paint: { "fill-extrusion-color": "#2FD39A", "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.95, "fill-extrusion-vertical-gradient": true } });
  add({ id: "alt-line", type: "line", source: "alt", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#8AA2EE", "line-width": 5, "line-dasharray": [0.4, 2.2] } });
  add({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#3DE3A6", "line-width": 18, "line-opacity": 0.22, "line-blur": 6 } });
  add({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#3DE3A6", "line-width": 6.5 } });
  add({ id: "route-flow", type: "line", source: "route", layout: { "line-cap": "round" }, paint: { "line-color": "#EFFFF8", "line-width": 2.5, "line-dasharray": [0, 4, 3] } });

  if (debug) {
    src(
      "graph-edges",
      fc(EDGES.map((e) => ({ ...line([NODE_BY_ID.get(e.a)!.pos, NODE_BY_ID.get(e.b)!.pos]), properties: { stairs: !!e.stairs } }))),
    );
    src("graph-nodes", fc(NODES.map((n) => ({ type: "Feature", properties: { id: n.id, entrance: n.kind === "entrance" }, geometry: { type: "Point", coordinates: ll(n.pos) } }))));
    add({ id: "graph-edges", type: "line", source: "graph-edges", paint: { "line-color": ["case", ["get", "stairs"], "#F48FC0", "#E7DD6A"], "line-width": 2, "line-dasharray": [2, 1] } });
    add({ id: "graph-nodes", type: "circle", source: "graph-nodes", paint: { "circle-radius": 5, "circle-color": ["case", ["get", "entrance"], "#3DE3A6", "#E7DD6A"], "circle-stroke-color": "#000", "circle-stroke-width": 1 } });
    if (map.getStyle().glyphs) {
      add({ id: "graph-labels", type: "symbol", source: "graph-nodes", layout: { "text-field": ["get", "id"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-offset": [0, 1.1] }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.5 } });
    }
  }
}

export default function CampusMap({
  route,
  alt,
  reports = [],
  destination,
  you,
  tilt = true,
  interactive = true,
  highContrast = false,
  animate = true,
  onPick,
  picked,
  focus,
  zoom,
  debug = false,
  className = "",
  padding = { top: 40, bottom: 40, left: 40, right: 40 },
}: CampusMapProps) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const markers = useRef<Marker[]>([]);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const latest = useRef({ route, alt, destination, tilt, padding, focus, zoom });
  latest.current = { route, alt, destination, tilt, padding, focus, zoom };
  // Re-applies route lines and the destination glow after the style (re)loads.
  const reapply = useRef<() => void>(() => undefined);

  /* ---------- create the map once ---------- */
  useEffect(() => {
    if (!box.current) return;
    const start = focus ?? route?.coords[0] ?? CAMPUS_CENTER;
    const map = new MLMap({
      container: box.current,
      style: vectorStyle(highContrast),
      center: ll(start),
      zoom: zoom ?? 16.6,
      ...(tilt ? TILT : FLAT),
      maxPitch: 75,
      interactive,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    let fellBack = false;
    let vectorOk = false; // true once any OpenFreeMap data arrives
    map.on("sourcedata", (e: Json) => {
      if (e.sourceId === "omt" && e.isSourceLoaded) vectorOk = true;
    });

    map.on("style.load", () => {
      map.setLight({ anchor: "viewport", color: "#C6D2FF", intensity: 0.42, position: [1.4, 210, 35] } as Json);
      addOverlayLayers(map, debug);
      ready.current = true;
      reapply.current();
    });
    map.on("error", (e: Json) => {
      // Vector tiles unreachable (offline, blocked network): switch to the raster fallback once.
      const fromVector = e?.sourceId === "omt" || String(e?.error?.message ?? "").includes("openfreemap");
      if (!fellBack && !vectorOk && fromVector) {
        fellBack = true;
        ready.current = false;
        map.setStyle(fallbackStyle());
      }
    });
    map.on("click", (e) => {
      const p: LatLng = [+e.lngLat.lat.toFixed(6), +e.lngLat.lng.toFixed(6)];
      if (debug) {
        const text = `[${p[0]}, ${p[1]}]`;
        navigator.clipboard?.writeText(text).catch(() => undefined);
        new Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(`<b>${text}</b><br><small>copied</small>`).addTo(map);
      }
      pickRef.current?.(p);
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      markers.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- route + alternative lines ---------- */
  const routeKey = route ? route.nodeIds.join() : "";
  const altKey = alt ? alt.nodeIds.join() : "";
  const applyLines = () => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const { route: r, alt: a } = latest.current;
    (map.getSource("route") as GeoJSONSource | undefined)?.setData(r ? line(r.coords) : fc([]));
    (map.getSource("alt") as GeoJSONSource | undefined)?.setData(a ? line(a.coords) : fc([]));
  };
  useEffect(applyLines, [routeKey, altKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- camera: fit route / focus point, and 2D <-> 3D ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const cam = tilt ? TILT : FLAT;
    const { route: r, focus: f, zoom: z, padding: pad } = latest.current;
    if (r && r.coords.length > 1) {
      const b = new LngLatBounds();
      r.coords.forEach((c) => b.extend(ll(c)));
      map.fitBounds(b, { padding: pad, maxZoom: 18, duration: 900, ...cam });
    } else if (f) {
      map.easeTo({ center: ll(f), zoom: z ?? 17.5, duration: 700, ...cam });
    } else {
      map.easeTo({ duration: 700, ...cam });
    }
  }, [tilt, routeKey, focus?.[0], focus?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- glow the destination building ---------- */
  const applyDest = () => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const { destination: d } = latest.current;
    const b = d ? BUILDING_BY_ID.get(d) : undefined;
    {
      const src = map.getSource("dest-bldg") as GeoJSONSource | undefined;
      if (!src) return;
      if (!b) {
        src.setData(fc([]));
        return;
      }
      // Prefer the real OpenStreetMap footprint under the building's position.
      const pt = map.project(ll(b.center));
      const hits = map.getLayer("bldg-3d") && map.getSource("omt") ? map.queryRenderedFeatures([[pt.x - 14, pt.y - 14], [pt.x + 14, pt.y + 14]], { layers: ["bldg-3d"] }) : [];
      const hit = hits[0] as Json;
      if (hit?.geometry) {
        const h = Math.max(Number(hit.properties?.render_height ?? 0), 12) + 0.6;
        src.setData(fc([{ type: "Feature", properties: { h }, geometry: hit.geometry }]));
      } else {
        src.setData(fc([poly(b.footprint, { h: b.floors * 4.5 + 0.6 })]));
      }
    }
  };
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Wait for tiles at the new camera position before looking up the footprint.
    const onIdle = () => applyDest();
    map.once("idle", onIdle);
    applyDest();
    return () => {
      map.off("idle", onIdle);
    };
  }, [destination, routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- switch style for high-contrast mode ---------- */
  const firstHc = useRef(highContrast);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || highContrast === firstHc.current) return;
    firstHc.current = highContrast;
    ready.current = false;
    map.setStyle(vectorStyle(highContrast));
  }, [highContrast]);

  /* ---------- HTML markers: reports, you, destination, picked ---------- */
  const reportsKey = reports.map((r) => `${r.id}:${reportStatus(r)}`).join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const addMarker = (node: HTMLElement, pos: LatLng, anchor: "bottom" | "center" = "bottom") => {
      markers.current.push(new Marker({ element: node, anchor, pitchAlignment: "viewport", rotationAlignment: "viewport" }).setLngLat(ll(pos)).addTo(map));
    };

    for (const r of reports) {
      if (reportStatus(r) === "resolved") continue;
      const node = reportEl(r);
      const open = (e: Event) => {
        e.stopPropagation();
        router.push(`/reports/${r.id}`);
      };
      node.addEventListener("click", open);
      node.addEventListener("keydown", (e) => (e as KeyboardEvent).key === "Enter" && open(e));
      addMarker(node, [r.lat, r.lng]);
    }
    const dest = destination ? BUILDING_BY_ID.get(destination) : undefined;
    if (dest && route) addMarker(pinEl("#3DE3A6", dest.name), route.coords[route.coords.length - 1]);
    if (picked) addMarker(pinEl("#F08CBB", "Report location"), picked);
    const me = you ?? route?.coords[0];
    if (me) addMarker(el("", "bx-you"), me, "center");
  }, [reportsKey, destination, routeKey, picked?.[0], picked?.[1], you?.[0], you?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- moving dashes along the route ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !animate || !route) return;
    const seq = [
      [0, 4, 3],
      [0.5, 4, 2.5],
      [1, 4, 2],
      [1.5, 4, 1.5],
      [2, 4, 1],
      [2.5, 4, 0.5],
      [3, 4, 0],
      [0, 0.5, 3, 3.5],
      [0, 1, 3, 3],
      [0, 1.5, 3, 2.5],
      [0, 2, 3, 2],
      [0, 2.5, 3, 1.5],
      [0, 3, 3, 1],
      [0, 3.5, 3, 0.5],
    ];
    let i = 0;
    const t = setInterval(() => {
      if (map.getLayer("route-flow")) map.setPaintProperty("route-flow", "line-dasharray", seq[(i = (i + 1) % seq.length)]);
    }, 70);
    return () => clearInterval(t);
  }, [animate, routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  reapply.current = () => {
    applyLines();
    applyDest();
  };

  // MapLibre's CSS forces `position: relative` on the element it draws into, so it
  // gets its own inner div; the outer one fills whatever space the page gives it.
  return (
    <div className={`map-wrap ${className}`} role="region" aria-label="Campus map">
      <div ref={box} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}