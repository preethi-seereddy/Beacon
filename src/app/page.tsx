"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Beau, Sparks } from "@/components/Beau";
import { Icon } from "@/components/Icon";
import { Skyline } from "@/components/Skyline";
import { PrefsPill } from "@/components/ui";
import { buildingSearch } from "@/lib/campus";

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = (e: FormEvent) => {
    e.preventDefault();
    const hits = buildingSearch(q);
    if (q.trim() && hits.length === 1) router.push(`/map?to=${hits[0].id}`);
    else router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
  };

  return (
    <main className="screen">
      <Skyline />
      <div className="relative z-[1]">
        <header className="flex items-start">
          <div>
            <div className="wm">
              <span>Beacon</span>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2c.6 5 2 7.4 7 8-5 .6-6.4 3-7 8-.6-5-2-7.4-7-8 5-.6 6.4-3 7-8z" fill="#E7DD6A" />
              </svg>
            </div>
            <p className="tagline">ACCESSIBLE NAVIGATION</p>
          </div>
          <span className="flex-1" />
          <Link className="ib relative !rounded-full" href="/community" aria-label="Community updates">
            <Icon name="bell" />
            <span className="absolute right-[10px] top-[9px] h-2 w-2 rounded-full bg-pink" />
          </Link>
        </header>

        <div className="relative mt-2 flex h-[132px] justify-center">
          <Sparks className="absolute left-[calc(50%-78px)] top-2" />
          <Beau size={104} />
        </div>

        <h1 className="mt-1.5 text-center text-[26px]">Where do you want to go?</h1>

        <form className="mt-4 flex flex-col gap-2.5" onSubmit={go} role="search">
          <label className="field field-neon min-h-[62px]">
            <span className="tone-mint">
              <Icon name="pin" />
            </span>
            <span className="sr-only-x">Destination</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a building or location" enterKeyHint="go" />
            <Link href="/beau" aria-label="Ask Beau by voice or text" className="text-mu">
              <Icon name="mic" />
            </Link>
          </label>
          <PrefsPill />
          <button className="btn btn-grad" type="submit">
            <Icon name="nav" />
            Find Route
          </button>
        </form>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Link className="qt qt-y" href="/search?tab=favorites">
            <span className="tile tone-yellow">
              <Icon name="bookmark" small />
            </span>
            Favorites
            <span className="flex-1" />
            <span className="tone-yellow">
              <Icon name="chev" small />
            </span>
          </Link>
          <Link className="qt qt-p" href="/search?tab=recent">
            <span className="tile tone-pink">
              <Icon name="clock" small />
            </span>
            Recent
            <span className="flex-1" />
            <span className="tone-pink">
              <Icon name="chev" small />
            </span>
          </Link>
        </div>

        <Link className="beaucard mt-3" href="/beau" aria-label="Chat with Beau on iMessage">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-[rgba(61,227,166,.1)]">
            <Beau size={34} still />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px]">Chat with Beau</b>
            <span className="text-xs text-mu">Directions &amp; reports by text</span>
          </span>
          <span className="go">
            <Icon name="arrow" small />
          </span>
        </Link>
      </div>
    </main>
  );
}
