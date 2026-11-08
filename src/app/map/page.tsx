"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";
import { MapView } from "@/components/MapView";
import { BUILDING_BY_ID } from "@/lib/campus";
import { useRoutePlan } from "@/lib/hooks";
import { useApp } from "@/lib/settings";
import { CATEGORY } from "@/lib/status";
import type { Preferences } from "@/lib/types";

const FILTERS: { key: keyof Preferences; label: string }[] = [
  { key: "stepFree", label: "Step-free" },
  { key: "avoidStairs", label: "Avoid stairs" },
  { key: "avoidElevators", label: "Avoid elevators" },
  { key: "preferRamps", label: "Prefer ramps" },
];

function MapInner() {
  const params = useSearchParams();
  const router = useRouter();
  const to = params.get("to");
  const debug = params.get("debug") === "1";
  const dest = to ? BUILDING_BY_ID.get(to) : undefined;
  const app = useApp();
  const { prefs, setPrefs, display, setDisplay, start, favorites, toggleFavorite, addRecent, motionOK } = app;
  const { recommended, alternative, reports } = useRoutePlan(dest ? dest.id : null);
  const [useAlt, setUseAlt] = useState(false);
  const chosen = useAlt && alternative ? alternative : recommended;
  const tilt = display.map3d && !debug;
  const activeFilters = FILTERS.filter((f) => prefs[f.key]).length;
  const avoided = recommended?.avoided ?? [];

  const startRoute = () => {
    if (!dest || !chosen) return;
    addRecent({ from: start.node, fromLabel: start.label === "Current location" ? "My location" : start.label.replace(" (demo start)", ""), to: dest.id, minutes: chosen.minutes });
    router.push(`/route?to=${dest.id}${useAlt ? "&alt=1" : ""}`);
  };

  return (
    <main className="relative h-[100dvh] overflow-hidden">
      <MapView
        className="absolute inset-0"
        route={chosen}
        alt={useAlt ? recommended : alternative}
        reports={reports}
        destination={dest?.id}
        you={start.pos}
        tilt={tilt}
        highContrast={display.highContrastMap}
        animate={motionOK}
        debug={debug}
      />

      <div className="absolute left-3.5 right-3.5 top-3.5 z-[700]">
        <div className="card glass flex items-center gap-1.5 !rounded-[18px] !border-[rgba(61,227,166,.4)] !py-2 !pl-1 !pr-2">
          <Link className="ib ib-bare" href="/" aria-label="Back home">
            <Icon name="back" />
          </Link>
          <Link href="/search" className="min-w-0 flex-1 no-underline">
            <p className="flex items-center gap-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-sky" />
              <span className="text-mu">{start.label}</span>
            </p>
            <p className="flex items-center gap-1.5 truncate font-semibold">
              <span className="h-2 w-2 flex-none rounded-full bg-mint" />
              {dest ? `${dest.short} · ${dest.name.replace(dest.short, "").replace(/^[\s&·-]+/, "") || dest.name}` : "Where to?"}
            </p>
          </Link>
          <Link className="ib" href="/search" aria-label="Change destination">
            <Icon name="swap" />
          </Link>
        </div>

        <div className="mt-2.5 flex flex-wrap items-start gap-2">
          <details className="relative">
            <summary className="chip glass list-none !border-[rgba(61,227,166,.55)] [&::-webkit-details-marker]:hidden">
              <span className="tone-mint">
                <Icon name="sliders" small />
              </span>
              Filters <span className="cnt">{activeFilters}</span>
            </summary>
            <div className="list glass absolute left-0 top-[50px] z-[800] w-[280px]">
              {FILTERS.map((f) => (
                <label key={f.key} className="row">
                  <span className="row-t">
                    <b>{f.label}</b>
                  </span>
                  <span className="switch">
                    <input type="checkbox" checked={prefs[f.key]} onChange={(e) => setPrefs({ [f.key]: e.target.checked })} />
                    <span />
                  </span>
                </label>
              ))}
            </div>
          </details>
          {avoided.length > 0 && (
            <Link href={`/reports/${avoided[0].id}`} className="chip glass !border-[rgba(240,140,187,.5)]">
              <span className="tone-pink">
                <Icon name="warn" small />
              </span>
              {avoided.length} obstacle{avoided.length > 1 ? "s" : ""} avoided
            </Link>
          )}
          {debug && <span className="chip glass">Debug: tap map to copy coordinates</span>}
        </div>
      </div>

      <div className="absolute right-3.5 z-[650] flex flex-col gap-2.5" style={{ bottom: dest ? 380 : 120 }}>
        <button className="fab" onClick={() => setDisplay({ map3d: !display.map3d })} aria-pressed={display.map3d} aria-label={display.map3d ? "Switch to 2D map (lets you pan)" : "Switch to 3D map"}>
          <span className="flex flex-col items-center text-[10px] font-bold leading-none tone-blue">
            <Icon name="cube" small />
            {display.map3d ? "3D" : "2D"}
          </span>
        </button>
        <button className="fab" onClick={app.locate} aria-label="Use my location">
          <span className="tone-blue">
            <Icon name="locate" />
          </span>
        </button>
        <Link className="fab !border-[rgba(240,140,187,.6)]" href="/report" aria-label="Report an issue here">
          <span className="tone-pink">
            <Icon name="plus" />
          </span>
        </Link>
      </div>

      {dest && (
        <section className="sheet" aria-label="Route options">
          <span className="handle" aria-hidden="true" />
          {!chosen ? (
            <div className="note note-warn">
              <span className="tone-pink">
                <Icon name="warn" small />
              </span>
              <p>
                No route to {dest.short} matches your filters right now. Try turning off a filter, or check{" "}
                <Link href="/community" className="underline">
                  community reports
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h2>
                  {chosen.minutes} min{" "}
                  <span className="font-sans text-sm font-medium text-mu">
                    · {(chosen.meters / 1609).toFixed(1)} mi · {chosen.ramps} ramp{chosen.ramps === 1 ? "" : "s"}
                  </span>
                </h2>
                <span className="flex-1" />
                {chosen.stairs === 0 ? (
                  <span className="badge b-ok">
                    <Icon name="check" />
                    Step-free
                  </span>
                ) : (
                  <span className="badge b-disputed">Has stairs</span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5" role="group" aria-label="Choose a route">
                <button className="ropt" aria-pressed={!useAlt} onClick={() => setUseAlt(false)}>
                  <span className="flex items-center gap-1.5 text-xs font-bold tone-mint">
                    <span className="sw" />
                    BEST
                  </span>
                  <span className="k">{recommended!.minutes} min</span>
                  <span className={`text-xs ${recommended!.verifiedSegments === recommended!.totalSegments ? "text-mu" : "tone-yellow"}`}>
                    {recommended!.verifiedSegments === recommended!.totalSegments ? "All verified" : `${recommended!.totalSegments - recommended!.verifiedSegments} unverified spot${recommended!.totalSegments - recommended!.verifiedSegments > 1 ? "s" : ""}`}
                  </span>
                </button>
                <button className="ropt" aria-pressed={useAlt} disabled={!alternative} onClick={() => setUseAlt(true)}>
                  <span className="flex items-center gap-1.5 text-xs font-bold tone-blue">
                    <span className="sw sw-alt" />
                    ALT
                  </span>
                  <span className="k">{alternative ? `${alternative.minutes} min` : "—"}</span>
                  <span className={`text-xs ${alternative && alternative.verifiedSegments < alternative.totalSegments ? "tone-yellow" : "text-mu"}`}>
                    {!alternative ? "No other route" : alternative.verifiedSegments === alternative.totalSegments ? "All verified" : `${alternative.totalSegments - alternative.verifiedSegments} unverified spot${alternative.totalSegments - alternative.verifiedSegments > 1 ? "s" : ""}`}
                  </span>
                </button>
              </div>

              {chosen.passes.length > 0 && (
                <p className="mt-2 text-xs tone-yellow">
                  Passes an unconfirmed report: {CATEGORY[chosen.passes[0].category].label.toLowerCase()} · {chosen.passes[0].locationLabel}
                </p>
              )}

              <div className="mt-3 flex gap-2.5">
                <button className="btn btn-grad flex-1" onClick={startRoute}>
                  <Icon name="nav" />
                  Start
                </button>
                <Link className="btn btn-alt btn-sm !w-auto !min-h-[54px] !border-[rgba(138,162,238,.5)]" href={`/route?to=${dest.id}${useAlt ? "&alt=1" : ""}`}>
                  Steps
                </Link>
                <button
                  className="ib !h-[54px] !w-[54px] !rounded-2xl !border-[rgba(231,221,106,.5)]"
                  aria-pressed={favorites.includes(dest.id)}
                  aria-label={favorites.includes(dest.id) ? `Remove ${dest.short} from favorites` : `Save ${dest.short} to favorites`}
                  onClick={() => toggleFavorite(dest.id)}
                >
                  <span className="tone-yellow">
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: favorites.includes(dest.id) ? "currentColor" : "none" }}>
                      <path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
                    </svg>
                  </span>
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {!dest && (
        <Link href="/search" className="field field-neon absolute bottom-[100px] left-3.5 right-3.5 z-[650]">
          <span className="tone-mint">
            <Icon name="search" />
          </span>
          <span>Where do you want to go?</span>
        </Link>
      )}
    </main>
  );
}

export default function MapPage() {
  return (
    <Suspense>
      <MapInner />
    </Suspense>
  );
}
