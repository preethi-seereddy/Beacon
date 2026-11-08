"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { prefsSummary, useApp } from "@/lib/settings";
import { CATEGORY, STATUS_LABEL, reportStatus } from "@/lib/status";
import type { Report, ReportStatus } from "@/lib/types";
import { Icon, type IconName } from "./Icon";

export function BackButton({ href, label = "Back" }: { href?: string; label?: string }) {
  const router = useRouter();
  if (href)
    return (
      <Link className="ib" href={href} aria-label={label}>
        <Icon name="back" />
      </Link>
    );
  return (
    <button className="ib" onClick={() => router.back()} aria-label={label}>
      <Icon name="back" />
    </button>
  );
}

export function TopBar({ back, title, subtitle, right }: { back?: string | true; title?: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-4 flex items-center gap-3">
      {back && <BackButton href={back === true ? undefined : back} />}
      <div className="min-w-0 flex-1">
        {title && <h2>{title}</h2>}
        {subtitle && <p className="text-xs text-mu">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

const STATUS_ICON: Record<ReportStatus, IconName> = { unverified: "warn", confirmed: "check", disputed: "x", resolved: "check" };

export function StatusBadge({ status, icon = true }: { status: ReportStatus; icon?: boolean }) {
  return (
    <span className={`badge b-${status}`}>
      {icon && <Icon name={STATUS_ICON[status]} />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ReportStatusBadge({ report }: { report: Report }) {
  return <StatusBadge status={reportStatus(report)} />;
}

export function CategoryTile({ report, size = 40 }: { report: Pick<Report, "category">; size?: number }) {
  const c = CATEGORY[report.category];
  return (
    <span className={`tile tone-${c.tone === "plain" ? "" : c.tone}`} style={{ width: size, height: size }}>
      <Icon name={c.icon} />
    </span>
  );
}

export function SwitchRow({
  icon,
  tone,
  title,
  sub,
  checked,
  onChange,
}: {
  icon?: IconName;
  tone?: "mint" | "pink" | "yellow" | "blue";
  title: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="row">
      {icon && (
        <span className={`tile tone-${tone ?? ""}`} style={{ width: 36, height: 36 }}>
          <Icon name={icon} small />
        </span>
      )}
      <span className="row-t">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
    </label>
  );
}

export function PrefsPill() {
  const { prefs } = useApp();
  const items = prefsSummary(prefs);
  const shown = items.slice(0, 2).join(" · ") || "No restrictions";
  return (
    <Link className="pref" href="/profile/preferences">
      <span className="tone-pink">
        <Icon name="sliders" small />
      </span>
      <span className="flex-1">
        <span className="text-mu">Route for:</span> <b>{shown}</b>
        {items.length > 2 && <span className="text-mu"> +{items.length - 2}</span>}
      </span>
      <span className="c">Change</span>
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="card text-center text-sm text-mu">{children}</p>;
}
