"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Leaderboard } from "@/components/Leaderboard";
import { CategoryTile, StatusBadge, TopBar } from "@/components/ui";
import { EDGES, NODE_BY_ID } from "@/lib/campus";
import { voteReport } from "@/lib/data";
import { distanceM } from "@/lib/geo";
import { useReports } from "@/lib/hooks";
import { useApp } from "@/lib/settings";
import { CATEGORY, reportStatus, timeAgo } from "@/lib/status";

export default function CommunityPage() {
  const { reports, loading, error } = useReports();
  const { start } = useApp();
  const [tab, setTab] = useState<"near" | "check">("near");
  const origin = start.pos ?? NODE_BY_ID.get(start.node)!.pos;

  const verifiedEdges = EDGES.filter((e) => e.verified).length;
  const mapped = Math.round((verifiedEdges / EDGES.length) * 100);
  const open = reports.filter((r) => reportStatus(r) !== "resolved").length;

  const shown = useMemo(() => {
    const list = tab === "check" ? reports.filter((r) => ["unverified", "disputed"].includes(reportStatus(r))) : reports;
    return [...list].sort((a, b) => distanceM(origin, [a.lat, a.lng]) - distanceM(origin, [b.lat, b.lng])).slice(0, 8);
  }, [reports, tab, origin]);

  const invite = () => {
    const url = location.origin;
    const text = "Help map accessible routes on campus with Beacon";
    if (navigator.share) navigator.share({ title: "Beacon", text, url }).catch(() => undefined);
    else navigator.clipboard?.writeText(`${text}: ${url}`);
  };

  return (
    <main className="screen">
      <TopBar
        back="/profile"
        title="Community"
        right={
          <button className="btn btn-pink btn-sm !w-auto" onClick={invite}>
            <Icon name="users" small />
            Invite
          </button>
        }
      />

      <div className="card grad-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-mu">Campus mapping progress</p>
            <h2>{mapped}% verified</h2>
          </div>
          <div className="text-center">
            <b className="font-display text-lg tone-pink">{open}</b>
            <p className="text-xs text-mu">open reports</p>
          </div>
        </div>
        <div className="bar mt-2.5">
          <i style={{ width: `${mapped}%`, background: "linear-gradient(90deg,#3DE3A6,#F08CBB)" }} />
        </div>
      </div>

      <div className="seg mt-3.5" role="group" aria-label="Filter reports">
        <button aria-pressed={tab === "near"} onClick={() => setTab("near")}>
          Near you
        </button>
        <button aria-pressed={tab === "check"} onClick={() => setTab("check")}>
          Needs a check
        </button>
      </div>

      {error && (
        <p className="note note-warn mt-3" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="mt-3 text-sm text-mu">Loading reports…</p>}
      {!loading && shown.length === 0 && <p className="card mt-3 text-sm text-mu">Nothing here right now. Nice!</p>}

      <div className="mt-3 flex flex-col gap-2.5">
        {shown.map((r) => {
          const s = reportStatus(r);
          const border = s === "unverified" ? "card-yl" : s === "resolved" ? "card-bl" : "card-pk";
          return (
            <div key={r.id} className={`card ${border} !p-3`}>
              <Link className="flex items-center gap-3 no-underline" href={`/reports/${r.id}`}>
                <CategoryTile report={r} />
                <span className="min-w-0 flex-1">
                  <b>{CATEGORY[r.category].label}</b>
                  <span className="block truncate text-xs text-mu">
                    {r.locationLabel} · {timeAgo(r.createdAt)}
                  </span>
                </span>
                <StatusBadge status={s} icon={false} />
              </Link>
              {(s === "unverified" || s === "disputed") && (
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <button className="btn btn-alt btn-sm" aria-pressed={r.myVote === "confirm"} onClick={() => voteReport(r.id, "confirm")}>
                    <span className="tone-mint">
                      <Icon name="check" small />
                    </span>
                    {r.myVote === "confirm" ? "Confirmed" : "Confirm"}
                  </button>
                  <button className="btn btn-alt btn-sm" aria-pressed={r.myVote === "dispute"} onClick={() => voteReport(r.id, "dispute")}>
                    <span className="tone-pink">
                      <Icon name="x" small />
                    </span>
                    {r.myVote === "dispute" ? "Disputed" : "Dispute"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2">
        <Leaderboard />
      </div>
    </main>
  );
}
