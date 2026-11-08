"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { MiniMap } from "@/components/MapView";
import { StatusBadge, TopBar } from "@/components/ui";
import { getReport, markResolved, onReportsChanged, voteReport } from "@/lib/data";
import { useApp } from "@/lib/settings";
import { CATEGORY, STATUS_HELP, STATUS_LABEL, clockTime, reportStatus, timeAgo } from "@/lib/status";
import type { Report, ReportStatus } from "@/lib/types";

function Detail({ id }: { id: string }) {
  const isNew = useSearchParams().get("new") === "1";
  const { display } = useApp();
  const [r, setR] = useState<Report | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getReport(id).then(setR).catch(() => setR(null));
  }, [id]);
  useEffect(() => {
    load();
    return onReportsChanged(load);
  }, [load]);

  if (r === undefined) return <main className="screen text-mu">Loading…</main>;
  if (r === null)
    return (
      <main className="screen">
        <TopBar back="/community" title="Report not found" />
        <p className="card text-sm text-mu">This report may have been removed.</p>
      </main>
    );

  const status = reportStatus(r);
  const cat = CATEGORY[r.category];

  const vote = async (v: "confirm" | "dispute") => {
    setBusy(true);
    try {
      setR(await voteReport(r.id, v));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = `${location.origin}/reports/${r.id}`;
    const text = `${cat.label} · ${r.locationLabel} (${STATUS_LABEL[status]}) — via Beacon`;
    if (navigator.share) {
      navigator.share({ title: "Beacon accessibility report", text, url }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="screen">
      <TopBar
        back="/community"
        title={cat.label}
        subtitle={r.locationLabel}
        right={
          <button className="ib !border-[rgba(240,140,187,.5)]" onClick={share} aria-label="Share report link">
            <span className="tone-pink">
              <Icon name={copied ? "check" : "link"} />
            </span>
          </button>
        }
      />
      {copied && (
        <p className="mb-2 text-xs tone-mint" role="status">
          Link copied
        </p>
      )}
      {isNew && (
        <p className="note note-info mb-3" role="status">
          <span className="tone-mint">
            <Icon name="check" small />
          </span>
          Thanks! Your report is on the map. Beacon routes around confirmed obstacles.
        </p>
      )}

      <MiniMap height={128} focus={[r.lat, r.lng]} zoom={18} reports={[r]} tilt={display.map3d} />

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge status={status} />
        <span className="badge b-plain">
          {r.confirmations} confirm · {r.disputes} dispute
        </span>
        <span className="badge b-plain !text-mu">
          <Icon name="clock" />
          {timeAgo(r.createdAt)}
        </span>
      </div>

      {(r.description || r.photoUrl) && (
        <div className="card card-pk mt-3 flex items-start gap-3">
          <p className="flex-1 text-sm">{r.description || "No description."}</p>
          {r.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.photoUrl} alt="Photo from reporter" className="h-[72px] w-[72px] flex-none rounded-[14px] object-cover" />
          )}
        </div>
      )}

      {status !== "resolved" && r.edgeId && (
        <p className="note note-info mt-2.5">
          <span className="tone-mint">
            <Icon name="route" small />
          </span>
          {status === "confirmed" ? "Beacon is routing around this." : status === "unverified" ? "Beacon avoids this when there’s a reasonable alternative." : "Reports disagree, so routes may still pass here."}
        </p>
      )}

      {status !== "resolved" && (
        <>
          <div className="sec">Is this still here?</div>
          <div className="grid grid-cols-2 gap-2.5">
            <button className="btn btn-alt !border-[rgba(61,227,166,.5)]" aria-pressed={r.myVote === "confirm"} disabled={busy} onClick={() => vote("confirm")} style={r.myVote === "confirm" ? { background: "rgba(61,227,166,.14)" } : undefined}>
              <span className="tone-mint">
                <Icon name="check" />
              </span>
              Still there
            </button>
            <button className="btn btn-alt !border-[rgba(240,140,187,.55)]" aria-pressed={r.myVote === "dispute"} disabled={busy} onClick={() => vote("dispute")} style={r.myVote === "dispute" ? { background: "rgba(227,109,155,.14)" } : undefined}>
              <span className="tone-pink">
                <Icon name="x" />
              </span>
              It’s clear
            </button>
          </div>
          <button className="mt-2 w-full py-3 text-center text-sm text-mu underline" onClick={() => markResolved(r.id)}>
            It’s been fixed — mark resolved
          </button>
        </>
      )}

      <div className="sec">Status</div>
      <div className="list">
        <div className="row">
          <StatusBadge status="unverified" icon={false} />
          <span className="row-t text-sm">Reported · {clockTime(r.createdAt)}</span>
        </div>
        {r.confirmations > 0 && (
          <div className="row">
            <StatusBadge status="confirmed" icon={false} />
            <span className="row-t text-sm">
              {r.confirmations} {r.confirmations === 1 ? "person" : "people"} confirmed
            </span>
          </div>
        )}
        {r.disputes > 0 && (
          <div className="row">
            <StatusBadge status="disputed" icon={false} />
            <span className="row-t text-sm">
              {r.disputes} {r.disputes === 1 ? "says" : "say"} it’s clear
            </span>
          </div>
        )}
        {r.resolvedAt && (
          <div className="row">
            <StatusBadge status="resolved" icon={false} />
            <span className="row-t text-sm">Fixed · {timeAgo(r.resolvedAt)}</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-mu">
        {(Object.keys(STATUS_HELP) as ReportStatus[]).map((s) => `${STATUS_LABEL[s]}: ${STATUS_HELP[s].toLowerCase()}`).join(" · ")}
      </p>
    </main>
  );
}

export default function ReportDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <Detail id={decodeURIComponent(params.id)} />
    </Suspense>
  );
}
