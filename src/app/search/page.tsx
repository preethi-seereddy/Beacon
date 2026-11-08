"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Skyline } from "@/components/Skyline";
import { PrefsPill, TopBar } from "@/components/ui";
import { BUILDINGS, BUILDING_BY_ID, NODE_BY_ID, buildingSearch } from "@/lib/campus";
import { distanceM } from "@/lib/geo";
import { useApp } from "@/lib/settings";
import { timeAgo } from "@/lib/status";
import type { Building } from "@/lib/types";

type Tab = "all" | "favorites" | "recent";

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { start, locate, favorites, recent, toggleFavorite } = useApp();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "all");

  const origin = start.pos ?? NODE_BY_ID.get(start.node)!.pos;
  const results = useMemo(() => {
    const list = tab === "favorites" && !q ? BUILDINGS.filter((b) => favorites.includes(b.id)) : buildingSearch(q);
    return [...list].sort((a, b) => distanceM(origin, a.center) - distanceM(origin, b.center));
  }, [q, tab, favorites, origin]);

  const stepFree = (b: Building) => b.entrances.some((id) => NODE_BY_ID.get(id)?.stepFree !== false);
  const miles = (b: Building) => (distanceM(origin, b.center) / 1609).toFixed(1);

  const chip = (t: Tab, label: string, icon: "list" | "star" | "clock", color: string) => (
    <button className="chip" aria-pressed={tab === t} onClick={() => setTab(t)} style={{ borderColor: tab === t ? color : undefined, background: tab === t ? "rgba(255,255,255,.04)" : undefined }}>
      <span style={{ color }}>
        <Icon name={icon} small />
      </span>
      {label}
    </button>
  );

  return (
    <main className="screen">
      <Skyline />
      <div className="relative z-[1]">
        <TopBar back="/" title="Plan a route" />

        <div className="card grad-border relative !rounded-[20px] !py-1 !pl-1 !pr-[62px]">
          <button className="field w-full !min-h-[50px] !border-0 !bg-transparent text-left" onClick={locate} aria-label="Starting point — tap to use my location">
            <span className="h-2.5 w-2.5 rounded-full bg-sky shadow-[0_0_8px_var(--bl2)]" />
            <span className="text-tx">{start.label}</span>
          </button>
          <div className="ml-[42px] h-px bg-line" />
          <label className="field !min-h-[50px] !border-0 !bg-transparent">
            <span className="h-2.5 w-2.5 rounded-full bg-mint shadow-[0_0_8px_var(--mint)]" />
            <span className="sr-only-x">Destination</span>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where to?" enterKeyHint="search" />
          </label>
          <Link className="ib absolute right-2.5 top-1/2 -translate-y-1/2 !border-[rgba(240,140,187,.5)]" href="/map" aria-label="Open map">
            <span className="tone-pink">
              <Icon name="pin" />
            </span>
          </Link>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Show">
          {chip("all", "All places", "list", "#3DE3A6")}
          {chip("favorites", "Favorites", "star", "#E7DD6A")}
          {chip("recent", "Recent", "clock", "#F08CBB")}
        </div>

        {tab === "recent" && !q ? (
          <>
            <div className="sec">Recent routes</div>
            {recent.length === 0 ? (
              <p className="card text-sm text-mu">Routes you take will show up here.</p>
            ) : (
              <div className="list">
                {recent.map((r) => (
                  <Link key={r.at} className="row" href={`/map?to=${r.to}`}>
                    <span className="tile tone-pink">
                      <Icon name="clock" />
                    </span>
                    <span className="row-t">
                      <b>
                        {r.fromLabel} → {BUILDING_BY_ID.get(r.to)?.short}
                      </b>
                      <span>
                        {r.minutes} min · {timeAgo(r.at)}
                      </span>
                    </span>
                    <Icon name="chev" small className="text-mu" />
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="sec">{q ? `Results for “${q}”` : tab === "favorites" ? "Favorites" : "Places"}</div>
            {results.length === 0 ? (
              <p className="card text-sm text-mu">{tab === "favorites" ? "Tap the star on a place to save it." : "No places match. Try a building code like ECSW."}</p>
            ) : (
              <div className="list max-h-[340px] overflow-y-auto">
                {results.map((b, i) => (
                  <div key={b.id} className="row">
                    <Link href={`/map?to=${b.id}`} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
                      <span className={`tile ${["tone-mint", "tone-pink", "tone-blue", "tone-yellow"][i % 4]}`}>
                        <Icon name={stepFree(b) ? "door" : "warn"} />
                      </span>
                      <span className="row-t">
                        <b>{b.short}</b>
                        <span>
                          {b.name} · {miles(b)} mi
                        </span>
                      </span>
                    </Link>
                    <button className="ib ib-bare" aria-label={favorites.includes(b.id) ? `Remove ${b.short} from favorites` : `Save ${b.short} to favorites`} aria-pressed={favorites.includes(b.id)} onClick={() => toggleFavorite(b.id)}>
                      <span className={favorites.includes(b.id) ? "tone-yellow" : "text-mu"}>
                        <Icon name="star" small />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mt-3.5">
          <PrefsPill />
        </div>
        <button className="btn btn-grad mt-3" disabled={!results.length} onClick={() => results[0] && router.push(`/map?to=${results[0].id}`)}>
          <Icon name="nav" />
          {results[0] && q ? `Route to ${results[0].short}` : "Find accessible route"}
        </button>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
