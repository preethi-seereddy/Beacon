"use client";

import Link from "next/link";
import { useState } from "react";
import { Beau } from "@/components/Beau";
import { Icon, type IconName } from "@/components/Icon";
import { BUILDING_BY_ID } from "@/lib/campus";
import { useReports } from "@/lib/hooks";
import { prefsSummary, useApp } from "@/lib/settings";

const BEAU_HANDLE = process.env.NEXT_PUBLIC_BEAU_IMESSAGE;

export default function ProfilePage() {
  const { name, mobility, setProfile, prefs, favorites, recent } = useApp();
  const { reports } = useReports();
  const [editing, setEditing] = useState(false);
  const checks = reports.filter((r) => r.myVote).length;

  const more: { href: string; icon: IconName; tone: string; title: string; right?: React.ReactNode }[] = [
    { href: "/beau", icon: "msg", tone: "tone-mint", title: "Beau on iMessage", right: <span className="badge b-disputed">{BEAU_HANDLE ? "Open" : "Set up"}</span> },
    { href: "/community", icon: "users", tone: "tone-pink", title: "Community" },
    { href: "/settings", icon: "contrast", tone: "tone-blue", title: "Display & Clarity Mode" },
  ];

  return (
    <main className="screen">
      <header className="mb-4 flex items-center gap-3">
        <h1 className="flex-1">Profile</h1>
        <Link className="ib" href="/settings" aria-label="Display settings">
          <Icon name="gear" />
        </Link>
      </header>

      <div className="card grad-border flex items-center gap-3">
        <span className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-full border-2 border-pink2 bg-s2 shadow-[0_0_16px_rgba(227,109,155,.35)]">
          <Beau size={44} still />
        </span>
        {editing ? (
          <form
            className="flex flex-1 flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              setEditing(false);
            }}
          >
            <label className="sr-only-x" htmlFor="pname">
              Name
            </label>
            <input id="pname" className="rounded-lg border border-line bg-s2 px-2 py-1.5" value={name} onChange={(e) => setProfile({ name: e.target.value })} />
            <label className="sr-only-x" htmlFor="pmob">
              Mobility
            </label>
            <input id="pmob" className="rounded-lg border border-line bg-s2 px-2 py-1.5 text-sm" value={mobility} onChange={(e) => setProfile({ mobility: e.target.value })} />
          </form>
        ) : (
          <div className="flex-1">
            <h3>{name}</h3>
            <p className="text-sm text-mu">{mobility}</p>
          </div>
        )}
        <button className="ib" aria-label={editing ? "Done editing" : "Edit profile"} onClick={() => setEditing(!editing)}>
          <Icon name={editing ? "check" : "edit"} />
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2.5">
        <div className="stat card-em">
          <b className="tone-mint">{checks}</b>
          <span>reports checked</span>
        </div>
        <div className="stat card-pk">
          <b className="tone-pink">{recent.length}</b>
          <span>recent routes</span>
        </div>
        <div className="stat card-yl">
          <b className="tone-yellow">{favorites.length}</b>
          <span>favorites</span>
        </div>
      </div>

      <Link className="btn btn-grad mt-3 !justify-start !px-4" href="/profile/preferences">
        <Icon name="sliders" />
        Manage accessibility preferences
        <span className="flex-1" />
        <Icon name="chev" small />
      </Link>
      <p className="mx-1 mt-1.5 text-xs text-mu">{prefsSummary(prefs).join(" · ") || "No restrictions set"}</p>

      <div className="sec">
        Favorites <Link href="/search?tab=favorites">Manage</Link>
      </div>
      {favorites.length === 0 ? (
        <p className="card text-sm text-mu">Star a place in search to save it here.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {favorites.slice(0, 4).map((id, i) => {
            const b = BUILDING_BY_ID.get(id);
            if (!b) return null;
            return (
              <Link key={id} className={`qt ${i % 2 ? "qt-p" : "qt-y"}`} href={`/map?to=${id}`}>
                <span className={`tile ${i % 2 ? "tone-pink" : "tone-yellow"}`}>
                  <Icon name="star" small />
                </span>
                <span className="truncate">{b.short}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="sec">More</div>
      <div className="list">
        {more.map((m) => (
          <Link key={m.href} className="row" href={m.href}>
            <span className={`tile ${m.tone}`} style={{ width: 36, height: 36 }}>
              <Icon name={m.icon} small />
            </span>
            <span className="row-t">
              <b>{m.title}</b>
            </span>
            {m.right ?? <Icon name="chev" small className="text-mu" />}
          </Link>
        ))}
      </div>
    </main>
  );
}
