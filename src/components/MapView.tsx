"use client";

import dynamic from "next/dynamic";
import type { CampusMapProps } from "./CampusMap";

// Leaflet touches `window`, so it only loads in the browser.
const CampusMap = dynamic(() => import("./CampusMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#0A1124] text-sm text-mu" role="status">
      Loading map…
    </div>
  ),
});

export function MapView(props: CampusMapProps) {
  return <CampusMap {...props} />;
}

/** Small non-interactive map used on detail screens. */
export function MiniMap({ height = 150, className = "", ...props }: CampusMapProps & { height?: number }) {
  return (
    <div className={`relative overflow-hidden rounded-[20px] border border-[rgba(240,140,187,.4)] ${className}`} style={{ height }}>
      <CampusMap {...props} interactive={false} className="absolute inset-0" />
    </div>
  );
}
