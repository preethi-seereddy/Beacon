"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NODE_BY_ID, suggestBuildings } from "@/lib/campus";
import { useApp } from "@/lib/settings";
import { Icon } from "./Icon";

/**
 * Bottom sheet for choosing a route's start or destination.
 * `null` means "my current location" (start only).
 */
export function LocationPicker({
  mode,
  current,
  exclude,
  onSelect,
  onClose,
}: {
  mode: "from" | "to";
  current: string | null;
  exclude?: string | null;
  onSelect: (buildingId: string | null) => void;
  onClose: () => void;
}) {
  const { start, locate } = useApp();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const origin = start.pos ?? NODE_BY_ID.get(start.node)!.pos;
  const list = useMemo(() => suggestBuildings(q, origin, 8).filter((s) => s.building.id !== exclude), [q, origin, exclude]);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = mode === "from" ? "Start from" : "Go to";

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="picker" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${mode === "from" ? "bg-sky" : "bg-mint"}`} />
          <h2 className="flex-1">{title}</h2>
          <button className="ib ib-bare" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>

        <label className="field field-neon">
          <span className="tone-mint">
            <Icon name="search" />
          </span>
          <span className="sr-only-x">{title}</span>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a building" autoComplete="off" enterKeyHint="search" />
        </label>

        <div className="no-scrollbar mt-3 max-h-[52vh] overflow-y-auto" role="listbox" aria-label="Places">
          {mode === "from" && !q && (
            <button
              type="button"
              role="option"
              aria-selected={current === null}
              className="suggest-row rounded-2xl"
              onClick={() => {
                locate();
                onSelect(null);
              }}
            >
              <span className="tile tone-blue" style={{ width: 34, height: 34 }}>
                <Icon name="locate" small />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <b className="block text-[14.5px]">Current location</b>
                <span className="block text-xs text-mu">{start.live ? "Using your GPS" : "GPS unavailable — using the demo start"}</span>
              </span>
              {current === null && <Icon name="check" small className="tone-mint" />}
            </button>
          )}
          {list.length === 0 && <p className="px-3.5 py-3 text-sm text-mu">No match for “{q}”.</p>}
          {list.map(({ building: b, meters }, i) => (
            <button key={b.id} type="button" role="option" aria-selected={current === b.id} className="suggest-row rounded-2xl" onClick={() => onSelect(b.id)}>
              <span className={`tile ${["tone-mint", "tone-pink", "tone-yellow", "tone-blue"][i % 4]}`} style={{ width: 34, height: 34 }}>
                <Icon name="pin" small />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <b className="block truncate text-[14.5px]">{b.short}</b>
                <span className="block truncate text-xs text-mu">{b.name}</span>
              </span>
              {current === b.id ? (
                <Icon name="check" small className="tone-mint" />
              ) : (
                <span className="text-xs font-semibold text-mu">{meters < 160 ? `${Math.round(meters * 3.28)} ft` : `${(meters / 1609).toFixed(1)} mi`}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
