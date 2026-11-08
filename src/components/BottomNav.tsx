"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/settings";

type Tab = "home" | "map" | "report" | "profile";

const TABS: { key: Tab; label: string; href: string; match: (p: string) => boolean }[] = [
  { key: "home", label: "Home", href: "/", match: (p) => p === "/" || p.startsWith("/search") },
  { key: "map", label: "Map", href: "/map", match: (p) => p.startsWith("/map") || p.startsWith("/route") || p.startsWith("/reports") },
  { key: "report", label: "Report", href: "/report", match: (p) => p === "/report" },
  { key: "profile", label: "Profile", href: "/profile", match: (p) => p.startsWith("/profile") || p.startsWith("/community") || p.startsWith("/beau") || p.startsWith("/settings") },
];

/** How long each tap animation runs, in ms (matches globals.css). */
const DURATION: Record<Tab, number> = { home: 1000, map: 1350, report: 1000, profile: 1000 };

function HomeIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function MapIcon() {
  // Folded map with a dotted path leading to a pin (the "1B" icon).
  return (
    <svg className="nav-icon nav-map" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6.5 8.5 4.5l7 2 5.5-2v13l-5.5 2-7-2L3 19.5z" />
      <g>
        <circle className="dot" cx="6.2" cy="16.4" r="0.95" />
        <circle className="dot" cx="8.6" cy="14.9" r="0.95" />
        <circle className="dot" cx="11.1" cy="14.2" r="0.95" />
        <circle className="dot" cx="13.6" cy="14.3" r="0.95" />
      </g>
      <path className="pin" d="M16.6 12.6s2.7-2.4 2.7-4.4a2.7 2.7 0 0 0-5.4 0c0 2 2.7 4.4 2.7 4.4z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg className="nav-icon nav-report" viewBox="0 0 24 24" aria-hidden="true">
      <path className="bulb-fill" d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z" />
      <g className="rays">
        <path d="M12 .2v1.2M4.6 3.2l.9.9M19.4 3.2l-.9.9M2 9.5h1.3M20.7 9.5H22" />
      </g>
      <path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z" />
      <path d="M12 7v3.5M12 13h.01" />
    </svg>
  );
}

function ProfileIcon() {
  // A tiny Beau: body, stripe, antennae and two wings that flutter.
  return (
    <svg className="nav-icon nav-profile" viewBox="0 0 24 24" aria-hidden="true">
      <path className="wing-l" d="M7.4 9.6C5 8 2.6 9 3 11s3 2.1 4.4 1.5" />
      <path className="wing-r" d="M16.6 9.6C19 8 21.4 9 21 11s-3 2.1-4.4 1.5" />
      <path d="M10.2 7 8.6 3.4M13.8 7l1.6-3.6" />
      <ellipse cx="12" cy="14" rx="5" ry="6.5" />
      <path d="M7.2 13.2h9.6" />
    </svg>
  );
}

const ICONS: Record<Tab, () => JSX.Element> = { home: HomeIcon, map: MapIcon, report: ReportIcon, profile: ProfileIcon };

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const { motionOK } = useApp();
  const [playing, setPlaying] = useState<{ tab: Tab; n: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const play = (tab: Tab) => {
    if (!motionOK) return;
    clearTimeout(timer.current);
    // Changing `n` remounts the icon so a second tap restarts the animation.
    setPlaying((p) => ({ tab, n: (p?.n ?? 0) + 1 }));
    timer.current = setTimeout(() => setPlaying(null), DURATION[tab] + 80);
  };

  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((t) => {
        const Ico = ICONS[t.key];
        const active = t.match(pathname);
        const isPlaying = playing?.tab === t.key;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={isPlaying ? `play-${t.key}` : undefined}
            onClick={() => play(t.key)}
          >
            <span key={isPlaying ? playing!.n : 0} style={{ display: "grid", placeItems: "center" }}>
              <Ico />
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
