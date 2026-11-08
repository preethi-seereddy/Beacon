"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { MapView } from "@/components/MapView";
import { BUILDINGS, NODE_BY_ID } from "@/lib/campus";
import { createReport } from "@/lib/data";
import { distanceM } from "@/lib/geo";
import { nearestEdge } from "@/lib/routing";
import { useApp } from "@/lib/settings";
import { CATEGORY } from "@/lib/status";
import type { LatLng, ReportCategory } from "@/lib/types";

const ORDER: ReportCategory[] = ["broken_elevator", "blocked_ramp", "stairs_path", "construction", "blocked_entrance", "other"];

function describe(pos: LatLng): string {
  const b = [...BUILDINGS].sort((x, y) => distanceM(pos, x.center) - distanceM(pos, y.center))[0];
  const e = nearestEdge(pos);
  const where = e.meters < 30 && e.edge.name ? ` · ${e.edge.name.replace(/^the /, "")}` : "";
  return `Near ${b.short}${where}`;
}

export default function ReportPage() {
  const router = useRouter();
  const { start } = useApp();
  const [pos, setPos] = useState<LatLng>(() => start.pos ?? NODE_BY_ID.get(start.node)!.pos);
  const [usingLive, setUsingLive] = useState(true);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (usingLive && start.pos) setPos(start.pos);
  }, [start.pos, usingLive]);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const label = useMemo(() => describe(pos), [pos]);
  const now = new Date().toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!category) {
      setError("Choose what kind of issue it is.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await createReport({ category, lat: pos[0], lng: pos[1], locationLabel: label, description: description.trim(), photo });
      router.push(`/reports/${r.id}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t send the report. Try again.");
      setBusy(false);
    }
  };

  return (
    <main className="screen">
      <header>
        <h1>Report an Issue</h1>
        <p className="mt-1 text-sm text-mu">Location and time are added for you.</p>
      </header>

      <form onSubmit={submit}>
        <div className="card card-pk mt-3.5 overflow-hidden !p-0">
          <div className="relative h-[130px]">
            <MapView
              className="absolute inset-0"
              focus={pos}
              zoom={18}
              picked={pos}
              onPick={(p) => {
                setUsingLive(false);
                setPos(p);
              }}
            />
          </div>
          <div className="row">
            <span className="row-t">
              <b>{label}</b>
              <span>{usingLive && start.live ? "Your current location" : "Tap the map to move the pin"}</span>
            </span>
            <span className="text-xs text-mu">{now}</span>
          </div>
        </div>

        <div className="sec">What’s the issue?</div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Issue type">
          {ORDER.map((c) => {
            const m = CATEGORY[c];
            return (
              <button key={c} type="button" className="cat" role="radio" aria-checked={category === c} aria-pressed={category === c} onClick={() => setCategory(c)}>
                <span className={`tile ${m.tone === "plain" ? "" : `tone-${m.tone}`}`}>
                  <Icon name={m.icon} small />
                </span>
                {m.short}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-stretch gap-2">
          <label className="field flex-1 !min-h-[76px] !items-start !px-3.5 !py-3">
            <span className="sr-only-x">Details (optional)</span>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (optional)" maxLength={500} />
          </label>
          <label className="ph w-[76px] cursor-pointer overflow-hidden !border-[rgba(240,140,187,.5)]">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Selected photo" className="h-full w-full object-cover" />
            ) : (
              <>
                <span className="tone-pink">
                  <Icon name="camera" />
                </span>
                <span className="text-xs">Photo</span>
              </>
            )}
            <input type="file" accept="image/*" capture="environment" className="sr-only-x" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {error && (
          <p className="note note-warn mt-3" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn-pink mt-3.5" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Submit report"}
        </button>
        <p className="mt-2 text-center text-xs text-mu">
          Shows as <b className="tone-yellow">Unverified</b> until others confirm.
        </p>
      </form>
    </main>
  );
}
