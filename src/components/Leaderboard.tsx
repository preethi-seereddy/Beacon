"use client";

import { POINTS } from "@/lib/data";
import { useLeaderboard } from "@/lib/hooks";
import { levelFor } from "@/lib/levels";
import { Icon } from "./Icon";

const MEDAL = ["#E7DD6A", "#8AA2EE", "#F08CBB"];

export function Leaderboard({ limit = 5 }: { limit?: number }) {
  const { rows, loading, error } = useLeaderboard();
  const top = rows.slice(0, limit);
  const myIndex = rows.findIndex((r) => r.isYou);
  const me = myIndex >= 0 ? rows[myIndex] : null;

  return (
    <section aria-labelledby="lb-title">
      <div className="sec">
        <span id="lb-title">Leaderboard</span>
        <span className="text-xs normal-case tracking-normal text-mu">verified help only</span>
      </div>

      {error && <p className="note note-warn">{error}</p>}
      {loading && !rows.length && <p className="text-sm text-mu">Loading…</p>}

      {top.length > 0 && (
        <ol className="list" aria-label="Top contributors">
          {top.map((r, i) => (
            <li key={r.uid} className="row" style={r.isYou ? { background: "rgba(61,227,166,.08)" } : undefined}>
              <span
                className="grid h-8 w-8 flex-none place-items-center rounded-full text-sm font-bold"
                style={i < 3 ? { background: `${MEDAL[i]}22`, color: MEDAL[i], boxShadow: `inset 0 0 0 1.5px ${MEDAL[i]}` } : { background: "var(--s2)", color: "var(--mu)" }}
                aria-label={`Rank ${i + 1}`}
              >
                {i + 1}
              </span>
              <span className="row-t">
                <b>
                  {r.name}
                  {r.isYou && <span className="ml-1.5 text-xs font-semibold tone-mint">(you)</span>}
                </b>
                <span>
                  {levelFor(r.points).name} · {r.verifiedReports} confirmed report{r.verifiedReports === 1 ? "" : "s"} · {r.checks} check{r.checks === 1 ? "" : "s"}
                </span>
              </span>
              <b className="font-display text-lg" style={{ color: i < 3 ? MEDAL[i] : "var(--tx)" }}>
                {r.points}
              </b>
            </li>
          ))}
          {me && myIndex >= limit && (
            <li className="row" style={{ background: "rgba(61,227,166,.08)" }}>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-s2 text-sm font-bold text-mu">{myIndex + 1}</span>
              <span className="row-t">
                <b>
                  {me.name} <span className="text-xs tone-mint">(you)</span>
                </b>
                <span>{levelFor(me.points).name}</span>
              </span>
              <b className="font-display text-lg">{me.points}</b>
            </li>
          )}
        </ol>
      )}

      <details className="mt-2 text-xs text-mu">
        <summary className="cursor-pointer py-2">How points work</summary>
        <ul className="mt-1 flex flex-col gap-1.5 pl-1">
          <li className="flex items-center gap-2">
            <span className="tone-pink">
              <Icon name="ramp" small />
            </span>
            +{POINTS.verifiedReport} when someone confirms your report
          </li>
          <li className="flex items-center gap-2">
            <span className="tone-blue">
              <Icon name="check" small />
            </span>
            +{POINTS.resolvedBonus} bonus when it gets fixed
          </li>
          <li className="flex items-center gap-2">
            <span className="tone-mint">
              <Icon name="shield" small />
            </span>
            +{POINTS.check} for each report you confirm or dispute
          </li>
          <li>Unconfirmed reports don’t earn points, so spam never wins.</li>
        </ul>
      </details>
    </section>
  );
}
