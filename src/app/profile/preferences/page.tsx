"use client";

import { SwitchRow, TopBar } from "@/components/ui";
import { useApp } from "@/lib/settings";

export default function PreferencesPage() {
  const { prefs, setPrefs, mobility, setProfile } = useApp();

  return (
    <main className="screen">
      <TopBar back="/profile" title="Accessibility preferences" subtitle="Every route uses these. Saved on this device." />

      <div className="list">
        <SwitchRow icon="shield" tone="mint" title="Step-free routes only" sub="Never route over steps or curbs" checked={prefs.stepFree} onChange={(v) => setPrefs({ stepFree: v, avoidStairs: v ? true : prefs.avoidStairs })} />
        <SwitchRow icon="stairs" tone="pink" title="Avoid stairs" sub={prefs.stepFree ? "Included in step-free" : undefined} checked={prefs.avoidStairs || prefs.stepFree} onChange={(v) => setPrefs({ avoidStairs: v })} />
        <SwitchRow icon="elev" tone="blue" title="Avoid elevators" sub="Only used when there’s no other way" checked={prefs.avoidElevators} onChange={(v) => setPrefs({ avoidElevators: v })} />
        <SwitchRow icon="ramp" tone="yellow" title="Prefer ramps" sub="Favor routes with ramps" checked={prefs.preferRamps} onChange={(v) => setPrefs({ preferRamps: v })} />
      </div>

      <div className="sec">How you get around</div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mobility">
        {["Manual wheelchair", "Power wheelchair", "Walker or cane", "Scooter", "Other"].map((m) => (
          <button key={m} className="chip" role="radio" aria-checked={mobility === m} onClick={() => setProfile({ mobility: m })} style={mobility === m ? { borderColor: "var(--pk2)", background: "rgba(227,109,155,.14)", color: "var(--pk2)" } : undefined}>
            {m}
          </button>
        ))}
      </div>

      <p className="note note-info mt-4">Beacon never presents unverified paths as guaranteed accessible. Unverified spots are flagged on every route.</p>
    </main>
  );
}
