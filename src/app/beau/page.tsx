"use client";

import { Beau, Sparks } from "@/components/Beau";
import { Icon, type IconName } from "@/components/Icon";
import { Skyline } from "@/components/Skyline";
import { TopBar } from "@/components/ui";
import { useApp } from "@/lib/settings";

const HANDLE = process.env.NEXT_PUBLIC_BEAU_IMESSAGE ?? "";

const CAN: { icon: IconName; tone: string; text: string }[] = [
  { icon: "route", tone: "tone-mint", text: "Accessible directions" },
  { icon: "warn", tone: "tone-pink", text: "Report obstacles" },
  { icon: "msg", tone: "tone-blue", text: "Ask follow-ups" },
  { icon: "bell", tone: "tone-yellow", text: "Route alerts" },
];

export default function BeauPage() {
  const { beauMemory, setProfile } = useApp();
  // `sms:` opens Messages (iMessage on Apple devices). "?&body=" works on both iOS and Android.
  const href = HANDLE ? `sms:${HANDLE}?&body=${encodeURIComponent("hi Beau")}` : undefined;

  return (
    <main className="screen">
      <Skyline />
      <div className="relative z-[1]">
        <TopBar back="/profile" right={<span className="badge b-disputed">Powered by Photon 2.0</span>} />

        <div className="flex items-center gap-3.5">
          <div className="relative">
            <Sparks className="absolute -left-2 -top-0.5" size={34} />
            <Beau size={96} />
          </div>
          <div className="flex-1">
            <h1>Meet Beau</h1>
            <p className="mt-1 text-sm text-mu">Your firefly guide on iMessage. Just text.</p>
          </div>
        </div>

        <div className="card card-pk mt-3.5 flex flex-col gap-2" aria-label="Example conversation">
          <p className="bub bub-me">Accessible route from the library to ECSW?</p>
          <p className="bub bub-them">Step-free, about 9 min. I routed around the blocked ramp by SSA.</p>
          <p className="bub bub-me">Elevator in JSOM east is out</p>
          <p className="bub bub-them">
            Logged it! It’s on the map as <b className="tone-yellow">Unverified</b>.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {CAN.map((c) => (
            <div key={c.text} className="flex items-center gap-2.5 rounded-[14px] border border-line bg-s1 p-2.5 text-[13px] font-semibold leading-tight">
              <span className={`tile ${c.tone}`} style={{ width: 34, height: 34 }}>
                <Icon name={c.icon} small />
              </span>
              {c.text}
            </div>
          ))}
        </div>

        <label className="card mt-3 flex items-center gap-3 !px-3.5 !py-3">
          <span className="flex-1">
            <b className="text-sm">Let Beau remember my preferences</b>
            <span className="block text-xs text-mu">Off until you turn it on</span>
          </span>
          <span className="switch">
            <input type="checkbox" checked={beauMemory} onChange={(e) => setProfile({ beauMemory: e.target.checked })} />
            <span />
          </span>
        </label>

        {href ? (
          <a className="btn btn-pink mt-3.5" href={href}>
            <Icon name="msg" />
            Message Beau
          </a>
        ) : (
          <button className="btn btn-pink mt-3.5" disabled title="Set NEXT_PUBLIC_BEAU_IMESSAGE to enable">
            <Icon name="msg" />
            Message Beau
          </button>
        )}
        <p className="mt-2 text-center text-xs text-mu">{href ? "Opens iMessage · send “hi” to link your account" : "Beau’s iMessage number isn’t set up yet"}</p>
      </div>
    </main>
  );
}
