"use client";

import { Icon } from "@/components/Icon";
import { SwitchRow, TopBar } from "@/components/ui";
import { useApp } from "@/lib/settings";

const SIZES = ["Smallest", "Small", "Default", "Large", "Largest"];

export default function SettingsPage() {
  const { display, setDisplay } = useApp();

  return (
    <main className="screen">
      <TopBar back="/profile" title="Display & Clarity" />

      <div className="card">
        <p className="text-xs font-bold tracking-widest text-mu">PREVIEW</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="sw !h-1.5 !w-8" />
          <b className="text-lg">Recommended · 6 min</b>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="badge b-ok">
            <Icon name="check" />
            Step-free
          </span>
          <span className="badge b-unverified">
            <Icon name="warn" />
            Unverified
          </span>
          <span className="badge b-disputed">
            <Icon name="x" />
            Disputed
          </span>
        </div>
      </div>

      <div className="list mt-3.5">
        <SwitchRow icon="contrast" tone="blue" title="Clarity Mode" sub="High contrast, no glow or animation" checked={display.clarity} onChange={(v) => setDisplay({ clarity: v })} />
        <SwitchRow icon="layers" tone="mint" title="High-contrast map" checked={display.highContrastMap} onChange={(v) => setDisplay({ highContrastMap: v })} />
        <SwitchRow icon="cube" tone="pink" title="3D map" sub="Turn off to pan and zoom freely" checked={display.map3d} onChange={(v) => setDisplay({ map3d: v })} />
        <SwitchRow icon="motion" tone="pink" title="Reduce motion" checked={display.reduceMotion} onChange={(v) => setDisplay({ reduceMotion: v })} />
        <SwitchRow icon="spark" tone="yellow" title="Beau animations" checked={display.beauAnimations} onChange={(v) => setDisplay({ beauAnimations: v })} />
      </div>

      <div className="sec">Text size</div>
      <div className="card !py-2">
        <label className="flex items-center gap-3">
          <span className="text-[13px] font-bold" aria-hidden="true">
            A
          </span>
          <span className="sr-only-x">Text size</span>
          <input
            type="range"
            min={1}
            max={5}
            value={display.textSize}
            onChange={(e) => setDisplay({ textSize: Number(e.target.value) })}
            aria-valuetext={SIZES[display.textSize - 1]}
            className="h-11 w-full accent-[var(--em)]"
          />
          <span className="text-2xl font-bold" aria-hidden="true">
            A
          </span>
        </label>
      </div>

      <div className="sec">Button size</div>
      <div className="seg" role="group" aria-label="Button size">
        <button aria-pressed={!display.bigTargets} onClick={() => setDisplay({ bigTargets: false })}>
          Standard
        </button>
        <button aria-pressed={display.bigTargets} onClick={() => setDisplay({ bigTargets: true })}>
          Extra large
        </button>
      </div>
      <p className="mt-3 text-xs text-mu">Beacon also follows your device’s Reduce Motion setting.</p>
    </main>
  );
}
