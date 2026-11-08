"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { MiniMap } from "@/components/MapView";
import { TopBar } from "@/components/ui";
import { BUILDING_BY_ID } from "@/lib/campus";
import { useRoutePlan } from "@/lib/hooks";
import { useApp } from "@/lib/settings";
import type { RouteStep } from "@/lib/types";

const STEP_ICON: Record<RouteStep["icon"], { icon: IconName; tone: string }> = {
  up: { icon: "up", tone: "tone-blue" },
  left: { icon: "left", tone: "tone-pink" },
  right: { icon: "right", tone: "tone-pink" },
  ramp: { icon: "ramp", tone: "tone-lime" },
  elevator: { icon: "elev", tone: "tone-blue" },
  door: { icon: "door", tone: "tone-mint" },
  warn: { icon: "warn", tone: "tone-yellow" },
};

function RouteInner() {
  const params = useSearchParams();
  const to = params.get("to");
  const dest = to ? BUILDING_BY_ID.get(to) : undefined;
  const { recommended, alternative } = useRoutePlan(dest?.id ?? null);
  const route = params.get("alt") === "1" && alternative ? alternative : recommended;
  const { start, display, favorites, toggleFavorite, motionOK } = useApp();
  const [step, setStep] = useState<number | null>(null);

  if (!dest) {
    return (
      <main className="screen">
        <TopBar back="/map" title="Route details" />
        <p className="card text-sm text-mu">Pick a destination first.</p>
      </main>
    );
  }

  const arrive = route ? new Date(Date.now() + route.minutes * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  const unverified = route ? route.totalSegments - route.verifiedSegments : 0;
  const pct = route ? Math.round((route.verifiedSegments / Math.max(1, route.totalSegments)) * 100) : 0;

  return (
    <main className="screen">
      <TopBar
        back={`/map?to=${dest.id}`}
        title={`To ${dest.short}`}
        subtitle={`From ${start.label.toLowerCase()} · arrive ~${arrive}`}
        right={
          <button
            className="ib !border-[rgba(240,140,187,.5)]"
            aria-label="Share route"
            onClick={() => {
              const url = `${location.origin}/map?to=${dest.id}`;
              if (navigator.share) navigator.share({ title: `Accessible route to ${dest.short}`, url }).catch(() => undefined);
              else navigator.clipboard?.writeText(url);
            }}
          >
            <span className="tone-pink">
              <Icon name="share" />
            </span>
          </button>
        }
      />

      <MiniMap route={route} destination={dest.id} you={start.pos} tilt={display.map3d} animate={motionOK} />

      {!route ? (
        <p className="note note-warn mt-3">No accessible route matches your preferences right now.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <div className="stat card-em">
              <b className="tone-mint">{route.minutes} min</b>
              <span>travel</span>
            </div>
            <div className="stat card-bl">
              <b className="tone-blue">{(route.meters / 1609).toFixed(1)} mi</b>
              <span>distance</span>
            </div>
            <div className="stat card-pk">
              <b className="tone-pink">{route.stairs}</b>
              <span>stairs</span>
            </div>
          </div>

          <div className="card card-em mt-3 !px-3.5 !py-3">
            <div className="flex justify-between text-sm">
              <b>Verified segments</b>
              <span className="tone-mint">
                {route.verifiedSegments} of {route.totalSegments}
              </span>
            </div>
            <div className="bar mt-2">
              <i style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-mu">
              {unverified === 0 ? "Every segment was checked recently." : `${unverified} segment${unverified > 1 ? "s haven’t" : " hasn’t"} been checked recently. Unverified spots aren’t guaranteed accessible.`}
            </p>
          </div>

          {step !== null ? (
            <section className="card grad-border mt-4" aria-live="polite">
              <p className="text-xs font-bold tracking-widest text-pink2">
                STEP {step + 1} OF {route.steps.length}
              </p>
              <div className="mt-2 flex items-start gap-3">
                <span className={`tile ${STEP_ICON[route.steps[step].icon].tone}`} style={{ width: 52, height: 52 }}>
                  <Icon name={STEP_ICON[route.steps[step].icon].icon} />
                </span>
                <div>
                  <h2>{route.steps[step].text}</h2>
                  {route.steps[step].detail && <p className="text-sm text-mu">{route.steps[step].detail}</p>}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <button className="btn btn-alt btn-sm" disabled={step === 0} onClick={() => setStep(step - 1)}>
                  Previous
                </button>
                {step < route.steps.length - 1 ? (
                  <button className="btn btn-grad btn-sm" onClick={() => setStep(step + 1)}>
                    Next step
                  </button>
                ) : (
                  <button className="btn btn-pink btn-sm" onClick={() => setStep(null)}>
                    I’ve arrived
                  </button>
                )}
              </div>
            </section>
          ) : (
            <>
              <div className="sec">Directions</div>
              <ol className="steps">
                {route.steps.map((s, i) => (
                  <li key={i}>
                    <span className={`tile ${STEP_ICON[s.icon].tone}`}>
                      <Icon name={STEP_ICON[s.icon].icon} />
                    </span>
                    <div>
                      <b>{s.text}</b>
                      {s.detail && <p className="text-xs text-mu">{s.detail}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          <div className="mt-3.5 flex gap-2.5">
            {step === null && (
              <button className="btn btn-grad flex-1" onClick={() => setStep(0)}>
                <Icon name="nav" />
                Start navigation
              </button>
            )}
            {step !== null && (
              <Link className="btn btn-alt flex-1" href={`/map?to=${dest.id}`}>
                Show on map
              </Link>
            )}
            <button
              className="ib !h-[54px] !w-[54px] !rounded-2xl !border-[rgba(231,221,106,.5)]"
              aria-pressed={favorites.includes(dest.id)}
              aria-label={favorites.includes(dest.id) ? "Remove from favorites" : "Save to favorites"}
              onClick={() => toggleFavorite(dest.id)}
            >
              <span className="tone-yellow">
                <Icon name="star" />
              </span>
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default function RoutePage() {
  return (
    <Suspense>
      <RouteInner />
    </Suspense>
  );
}
