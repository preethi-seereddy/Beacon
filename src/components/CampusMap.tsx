"use client";

/**
 * Interactive campus map (React Leaflet + OpenStreetMap).
 *
 * "3D" view: Leaflet is a 2D library, so 3D is done by tilting the map with a CSS
 * perspective transform and drawing each building as a stack of offset polygons
 * (a fake extrusion). Dragging is turned off while tilted, because Leaflet's pointer
 * math doesn't account for the transform; markers stay tappable.
 */
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { BUILDINGS, BUILDING_BY_ID, CAMPUS_BOUNDS, CAMPUS_CENTER } from "@/lib/campus";
import { CATEGORY, reportStatus } from "@/lib/status";
import type { Building, LatLng, PlannedRoute, Report } from "@/lib/types";
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
}

const ACCENT: Record<Building["accent"], string> = { mint: "#3DE3A6", pink: "#F48FC0", yellow: "#E7DD6A", blue: "#8AA2EE" };
const STEP = 0.000011; // latitude offset per extrusion layer

function div(html: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({ html, className: "bx-icon", iconSize: size, iconAnchor: anchor });
}

function reportIcon(r: Report) {
  const s = reportStatus(r);
  const c = s === "unverified" ? "#E7DD6A" : s === "resolved" ? "#8AA2EE" : "#F48FC0";
  const bg = s === "unverified" ? "#26240F" : s === "resolved" ? "#121A36" : "#2E1530";
  return div(
    `<div class="bx-lift" style="display:flex;flex-direction:column;align-items:center">
       <div class="bx-marker" style="--c:${c};--bgc:${bg}">${iconSvg(CATEGORY[r.category].icon)}</div>
       <div style="width:2px;height:12px;background:${c}"></div>
     </div>`,
    [34, 46],
    [17, 46],
  );
}

const pinIcon = (color: string) =>
  div(
    `<div class="bx-lift"><svg width="34" height="42" viewBox="0 0 28 34" aria-hidden="true"><path d="M14 33C5 22 1 16 1 11a13 13 0 0 1 26 0c0 5-4 11-13 22z" fill="${color}" stroke="#06130F" stroke-width="2"/><circle cx="14" cy="11" r="4.5" fill="#06130F"/></svg></div>`,
    [34, 42],
    [17, 42],
  );

function tagIcon(b: Building) {
  return div(`<span class="bx-tag" style="--c:${ACCENT[b.accent]}">${b.short}</span>`, [0, 0], [0, 0]);
}

function shift(poly: LatLng[], dLat: number): LatLng[] {
  return poly.map(([a, b]) => [a + dLat, b]);
}

function FitView({ route, focus, zoom, tilt, interactive }: { route?: PlannedRoute | null; focus?: LatLng | null; zoom?: number; tilt?: boolean; interactive?: boolean }) {
  const map = useMap();
  const key = route ? route.nodeIds.join() : focus ? focus.join() : "";
  useEffect(() => {
    if (route && route.coords.length > 1) {
      map.fitBounds(L.latLngBounds(route.coords), { padding: [40, 40], maxZoom: 18 });
    } else if (focus) {
      map.setView(focus, zoom ?? 18);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 550);
    const handlers = [map.dragging, map.scrollWheelZoom, map.touchZoom, map.doubleClickZoom, map.keyboard];
    for (const h of handlers) {
      if (tilt || !interactive) h.disable();
      else h.enable();
    }
    return () => clearTimeout(t);
  }, [tilt, interactive, map]);
  return null;
}

function ClickHandler({ onPick, debug }: { onPick?: (p: LatLng) => void; debug?: boolean }) {
  const map = useMapEvents({
    click(e) {
      const p: LatLng = [+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)];
      if (debug) {
        const text = `[${p[0]}, ${p[1]}]`;
        navigator.clipboard?.writeText(text).catch(() => undefined);
        L.popup().setLatLng(e.latlng).setContent(`${text}<br><small>copied</small>`).openOn(map);
      }
      onPick?.(p);
    },
  });
  return null;
}

export default function CampusMap({
  route,
  alt,
  reports = [],
  destination,
  you,
  tilt = false,
  interactive = true,
  highContrast = false,
  animate = true,
  onPick,
  picked,
  focus,
  zoom,
  debug,
  className = "",
}: CampusMapProps) {
  const router = useRouter();
  const canDrag = interactive && !tilt;

  // Draw northern buildings first so nearer (southern) ones overlap them in 3D.
  const buildings = useMemo(() => [...BUILDINGS].sort((a, b) => b.center[0] - a.center[0]), []);
  const dest = destination ? BUILDING_BY_ID.get(destination) : undefined;
  const visibleReports = reports.filter((r) => reportStatus(r) !== "resolved");

  return (
    <div className={`map-wrap ${tilt ? "is3d" : ""} ${className}`}>
      <div className="map-tilt">
        <MapContainer
          center={focus ?? CAMPUS_CENTER}
          zoom={zoom ?? 17}
          minZoom={15}
          maxZoom={19}
          maxBounds={L.latLngBounds(CAMPUS_BOUNDS).pad(0.6)}
          zoomControl={false}
          dragging={canDrag}
          scrollWheelZoom={canDrag}
          touchZoom={canDrag}
          doubleClickZoom={canDrag}
          keyboard={canDrag}
          className={`dark-tiles ${highContrast ? "hc" : ""}`}
        >
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' maxZoom={19} />

          {buildings.map((b) => {
            const color = ACCENT[b.accent];
            const isDest = b.id === destination;
            if (!tilt) {
              return (
                <Polygon
                  key={b.id}
                  positions={b.footprint}
                  pathOptions={{ color, weight: isDest ? 2.5 : 1.5, fillColor: isDest ? "#17574A" : "#1C2750", fillOpacity: 0.85 }}
                  interactive={false}
                />
              );
            }
            const layers = b.floors * 2;
            return (
              <Fragment key={b.id}>
                {Array.from({ length: layers }, (_, i) => (
                  <Polygon
                    key={i}
                    positions={shift(b.footprint, i * STEP)}
                    pathOptions={{ stroke: i === 0, color, weight: 0.8, opacity: 0.5, fillColor: i % 3 === 1 ? "#24315F" : "#1A2449", fillOpacity: 1 }}
                    interactive={false}
                  />
                ))}
                <Polygon
                  positions={shift(b.footprint, layers * STEP)}
                  pathOptions={{ color, weight: isDest ? 2.5 : 1.6, fillColor: isDest ? "#17574A" : "#3A4C8C", fillOpacity: 1 }}
                  interactive={false}
                />
              </Fragment>
            );
          })}

          {alt && <Polyline positions={alt.coords} pathOptions={{ color: "#8AA2EE", weight: 5, dashArray: "1 10", lineCap: "round" }} interactive={false} />}
          {route && (
            <>
              <Polyline positions={route.coords} pathOptions={{ color: "#3DE3A6", weight: 16, opacity: 0.2, lineCap: "round", lineJoin: "round" }} interactive={false} />
              <Polyline positions={route.coords} pathOptions={{ color: "#3DE3A6", weight: 6, lineCap: "round", lineJoin: "round" }} interactive={false} />
              {animate && <Polyline positions={route.coords} pathOptions={{ color: "#EFFFF8", weight: 2.5, className: "route-flow", lineCap: "round" }} interactive={false} />}
            </>
          )}

          {buildings.map((b) => (
            <Marker
              key={`tag-${b.id}`}
              position={[b.footprint[0][0] + (tilt ? b.floors * 2 * STEP : 0), b.center[1]]}
              icon={tagIcon(b)}
              interactive={false}
              keyboard={false}
            />
          ))}

          {visibleReports.map((r) => (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={reportIcon(r)}
              title={`${CATEGORY[r.category].label} — ${r.locationLabel}`}
              alt={`${CATEGORY[r.category].label} report`}
              eventHandlers={{ click: () => router.push(`/reports/${r.id}`) }}
            />
          ))}

          {dest && route && <Marker position={route.coords[route.coords.length - 1]} icon={pinIcon("#3DE3A6")} title={dest.name} />}
          {picked && <Marker position={picked} icon={pinIcon("#F08CBB")} title="Report location" />}
          {(you ?? route?.coords[0]) && <Marker position={(you ?? route!.coords[0]) as LatLng} icon={div('<div class="bx-you"></div>', [18, 18], [9, 9])} title="You" keyboard={false} />}

          <FitView route={route} focus={focus} zoom={zoom} tilt={tilt} interactive={interactive} />
          {(onPick || debug) && <ClickHandler onPick={onPick} debug={debug} />}
        </MapContainer>
      </div>
    </div>
  );
}
