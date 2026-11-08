// Beau self-check: tells you exactly which piece is missing when Beau won't text back.
//   npm run beau:check
// Never prints secret values, only whether they're set and whether they work.

import { Photon } from "@photon-ai/api";
import { createClient } from "@supabase/supabase-js";

const ok = (m: string) => console.log(`  ✅ ${m}`);
const bad = (m: string, fix?: string) => console.log(`  ❌ ${m}${fix ? `\n     → ${fix}` : ""}`);
const warn = (m: string, fix?: string) => console.log(`  ⚠️  ${m}${fix ? `\n     → ${fix}` : ""}`);
const env = (k: string) => (process.env[k] ?? "").trim();

async function timed<T>(p: Promise<T>, ms = 12_000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms / 1000}s`)), ms))]);
}

async function main() {
  console.log("\nBeau self-check\n");

  // 1. Node + env file -------------------------------------------------------
  console.log("1. Setup");
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj > 22 || (maj === 22 && min >= 9)) ok(`Node ${process.versions.node}`);
  else bad(`Node ${process.versions.node} is too old for the Beau scripts`, "Install Node 22 LTS or newer from nodejs.org, then reopen VS Code");
  const anyKey = ["PHOTON_API_KEY", "SPECTRUM_PROJECT_ID", "NEXT_PUBLIC_SUPABASE_URL", "NVIDIA_API_KEY", "OPENAI_API_KEY"].some((k) => env(k));
  if (anyKey) ok(".env.local was loaded");
  else bad("No keys found at all", "Create .env.local in the project folder (copy .env.example) and run this from that folder");

  // 2. Which Photon connector ------------------------------------------------
  console.log("\n2. iMessage connection (Photon)");
  const beta = Boolean(env("PHOTON_PROJECT_ID") && env("PHOTON_API_KEY"));
  const spectrum = Boolean(env("SPECTRUM_PROJECT_ID") && env("SPECTRUM_PROJECT_SECRET"));
  if (!beta && !spectrum) {
    bad("No Photon keys set", "Fill EITHER PHOTON_PROJECT_ID + PHOTON_API_KEY (app.beta.photon.codes) OR SPECTRUM_PROJECT_ID + SPECTRUM_PROJECT_SECRET (app.photon.codes)");
  }
  if (beta && spectrum) warn("Both Photon dashboards are configured", "Use only the one where Beau's number lives. Beta → npm run imessage:beta, Spectrum → npm run imessage");

  if (beta) {
    const project = env("PHOTON_PROJECT_ID");
    if (!project.startsWith("pho_prj_")) bad(`PHOTON_PROJECT_ID should start with pho_prj_ (yours starts with "${project.slice(0, 8)}…")`, "Copy it from Photon 2.0 dashboard → Settings");
    const photon = new Photon({ headers: { Authorization: `Bearer ${env("PHOTON_API_KEY")}` } });
    try {
      const page = await timed(
        photon.projects.listMessages({ path: { id: project }, query: { direction: "received", order: "desc", pageSize: 5 } } as never),
      );
      ok("Photon 2.0 API key works → run: npm run imessage:beta");
      const items = ((page as { items?: unknown[] }).items ?? []) as Array<Record<string, any>>;
      if (!items.length) {
        warn("Photon has received NO texts for this project", "Text Beau's number from a phone you added under iMessage in the Photon dashboard. Texts from other phones are dropped by Photon.");
      } else {
        console.log("     Last texts Photon received (newest first):");
        for (const m of items) {
          const text = JSON.stringify(m.content?.text ?? m.content?.type ?? "").slice(0, 40);
          const accepted = m.status === "received" && m.sentBy?.kind === "human" && m.receivedBy?.kind === "agent";
          console.log(
            `       ${accepted ? "✓" : "✗"} ${m.createdAt ?? "?"}  from ${m.sentBy?.handle ?? "?"}  ${text}` +
              (accepted ? "" : `   (skipped: status=${m.status}, sentBy.kind=${m.sentBy?.kind}, receivedBy.kind=${m.receivedBy?.kind})`),
          );
        }
        if (items.some((m) => !(m.status === "received" && m.sentBy?.kind === "human" && m.receivedBy?.kind === "agent"))) {
          warn("Some texts are being skipped by Beau's filter", "Send this output to whoever wrote agent/photon.ts — the field values above show why");
        }
      }
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 401 || err.status === 403) bad(`Photon rejected the key (${err.status})`, "Make a new API key with project:read AND project:write, and check PHOTON_PROJECT_ID matches that project");
      else if (err.status === 404) bad("Photon says the project doesn't exist (404)", "PHOTON_PROJECT_ID is wrong, or the key belongs to a different project");
      else bad(`Couldn't reach Photon: ${err.message ?? e}`, "Check your internet / Wi-Fi, then try again");
    }
  }

  if (spectrum) {
    try {
      const { Spectrum } = await import("spectrum-ts");
      const { imessage } = await import("spectrum-ts/providers/imessage");
      const app = await timed(
        Spectrum({ projectId: env("SPECTRUM_PROJECT_ID"), projectSecret: env("SPECTRUM_PROJECT_SECRET"), providers: [imessage.config()], signal: AbortSignal.timeout(15_000) }),
        20_000,
      );
      ok("Connected to Photon Spectrum → run: npm run imessage");
      (app as unknown as { close?: () => void }).close?.();
    } catch (e) {
      bad(`Spectrum connection failed: ${(e as Error).message}`, "Re-copy SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET from app.photon.codes → Get started → Add your credentials");
    }
  }

  // 3. Brain ---------------------------------------------------------------
  console.log("\n3. Beau's brain (AI model)");
  const nv = env("NVIDIA_API_KEY");
  const oa = env("OPENAI_API_KEY");
  if (!nv && !oa) warn("No AI key: Beau will use simple keyword rules", "Fine for a demo. For smarter replies set NVIDIA_API_KEY (build.nvidia.com) or OPENAI_API_KEY");
  else {
    const base = nv ? env("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1" : env("OPENAI_BASE_URL") || "https://api.openai.com/v1";
    try {
      const r = await timed(fetch(`${base}/models`, { headers: { Authorization: `Bearer ${nv || oa}` } }));
      if (r.ok) ok(`${nv ? "NVIDIA" : "OpenAI"} key works`);
      else bad(`${nv ? "NVIDIA" : "OpenAI"} rejected the key (${r.status})`, "Create a fresh key and paste it with no spaces or quotes");
    } catch (e) {
      bad(`Couldn't reach the model: ${(e as Error).message}`);
    }
  }

  // 4. Database --------------------------------------------------------------
  console.log("\n4. Shared database (Supabase)");
  const url = env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) warn("No Supabase URL: Beau's reports won't reach the website map", "Set NEXT_PUBLIC_SUPABASE_URL");
  else if (!service) warn("No SUPABASE_SERVICE_ROLE_KEY: Beau runs on memory only", "Copy the service_role / secret key from Supabase → Project Settings → API");
  else {
    const db = createClient(url, service);
    for (const table of ["reports_with_counts", "report_votes", "subscribers", "verification_asks", "leaderboard"]) {
      const { error } = await db.from(table).select("*", { head: true, count: "exact" });
      if (error) bad(`${table}: ${error.message}`, "Run supabase/schema.sql again in the Supabase SQL editor");
      else ok(`${table} table is reachable`);
    }
  }

  console.log("\nIf everything above is ✅: start Beau with the command shown in section 2, KEEP THAT TERMINAL OPEN,");
  console.log("and text Beau's number from a phone listed in your Photon dashboard. Each text should print a [beau] ← line.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error("check crashed:", e);
  process.exit(1);
});
