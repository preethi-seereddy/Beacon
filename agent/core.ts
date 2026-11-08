// Beau's brain, independent of how messages arrive.
//
// Two Photon connectors feed it:
//   agent/spectrum.ts  — Photon Spectrum SDK (dashboard: app.photon.codes)
//   agent/photon.ts    — Photon 2.0 beta HTTP API (dashboard: app.beta.photon.codes)
// Both get identical behaviour: routes, text + photo reports, YES/NO
// verification, watched-route alerts, STOP/START.

import { ApiError } from "@photon-ai/api";
import { setTimeout as sleep } from "node:timers/promises";
import { BUILDINGS } from "../src/lib/campus";
import { planRoute } from "../src/lib/routing";
import { CATEGORY } from "../src/lib/status";
import type { ReportCategory } from "../src/lib/types";
import { MODEL_LABEL, runBeau, type Msg } from "./beau";
import {
  DEFAULT_PREFS, beauUserId, find_accessible_route, placeName, resolve_location, routeLines, submit_report, type ToolContext,
} from "./toolImpl";
import * as store from "./store";

const HAS_MODEL = Boolean(process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY);
const WATCH_MS = 5_000;

export const brainLabel = HAS_MODEL ? `${MODEL_LABEL} + tools` : "rule-based router (no NVIDIA_API_KEY / OPENAI_API_KEY)";
export const dataLabel = store.db ? "Supabase (shared with the web map)" : "memory only (no Supabase keys)";

export function describe(err: unknown) {
  return err instanceof ApiError
    ? `Photon ${err.status} (request ${err.requestId ?? "?"})`
    : (err as Error)?.message ?? String(err);
}

/** One inbound message, already unwrapped by a connector. */
export interface Incoming {
  platform: string;
  /** The person's phone number / email / platform user id. */
  handle: string;
  /** Conversation id, stored so Beau can text back later. */
  spaceId: string;
  /** Which agent identity received it (Photon 2.0); connectors without one pass a constant. */
  agentUserId: string;
  text: string;
  /** Lazy photo loaders, so nothing downloads unless it's an image we keep. */
  photos: Array<() => Promise<{ bytes: Blob; contentType: string } | undefined>>;
}

/** How a connector sends an unsolicited text to a known subscriber. */
export type Deliver = (s: store.Subscriber, text: string, key: string) => Promise<void>;

const place = placeName;
const KIND_TEXT = (c: ReportCategory) => CATEGORY[c].label.toLowerCase();
/** Buildings Beau can route to, for "I don't know that place" replies. */
const COVERED = BUILDINGS.map((b) => b.short).join(", ");

// ---------------------------------------------------------------------------
// Conversation state (memory is per process; durable state lives in Supabase)
// ---------------------------------------------------------------------------

const histories = new Map<string, Msg[]>();          // subscriber/space -> model history
const pendingPhotos = new Map<string, string>();
const pendingReports = new Map<string, { kind: ReportCategory; text: string }>(); // asked "where is it?"
const origins = new Map<string, string>();
const helped = new Set<string>();                    // people who've seen the full welcome

/** Full welcome the first time; after that, a short nudge instead of repeating it. */
function helpOnce(key: string) {
  if (!helped.has(key)) { helped.add(key); return HELP; }
  return "Sorry, I didn't catch that. Try \"route from the Union to the library\", tell me about a problem like \"the library ramp is blocked\", or text HELP.";
}           // subscriber -> where they said they are      // subscriber -> photo URL awaiting a location
const lastNudge = new Map<string, number>();          // subscriber -> last unsolicited text (ms)
const NUDGE_GAP_MS = 10 * 60_000;                     // "elevate the moment without demanding attention"

export const HELP =
  "Hi, I'm Beau ✨ I find step-free routes around UTD and keep them up to date with reports from people like you.\n\n" +
  "• \"Route from the Student Union to the library\"\n" +
  "• \"The SSA ramp is blocked\" (send a photo too!)\n" +
  "• STOP to pause alerts, START to resume";

// ---------------------------------------------------------------------------
// Answering one message
// ---------------------------------------------------------------------------

/** Rule-based answers for when the model is unavailable. Covers the two
 *  things that matter mid-journey: directions, and reporting a problem. */
async function savePhoto(load: Incoming["photos"][number]): Promise<string | undefined> {
  try {
    const photo = await load();
    if (!photo || !photo.contentType.startsWith("image/")) return undefined;
    return await store.uploadPhoto(photo.bytes, photo.contentType);
  } catch (err) {
    console.error("[beau] photo download failed:", describe(err));
    return undefined;
  }
}

async function fallbackReply(text: string, ctx: ToolContext, key = ""): Promise<string> {
  const problem = /broken|out of order|out of service|not working|down\b|blocked|closed|obstruct|can'?t get|construction|torn up|fenced/i.test(text);
  const kind: ReportCategory | null = !problem ? null
    : /construction|torn up|fenc/i.test(text) ? "construction"
    : /elevator|lift/i.test(text) ? "broken_elevator"
    : /ramp/i.test(text) ? "blocked_ramp"
    : /door|entrance|button/i.test(text) ? "blocked_entrance"
    : /stairs|steps/i.test(text) ? "stairs_path"
    : "other";

  // They're answering "where exactly is it?" from their previous message.
  const waiting = pendingReports.get(key);
  if (!kind && waiting && isSpecificPlace(text)) {
    pendingReports.delete(key);
    return fileReport(waiting.kind, text, `${waiting.text} (at ${text})`, ctx);
  }

  if (kind) {
    const where = text.replace(/\b(the|is|are|was|totally|completely|again|broken|out of order|out of service|not working|down|blocked|closed|construction|fenced|there'?s|there is)\b/gi, " ").trim();
    // "the ramp is blocked" names no place: ask, never guess which ramp.
    if (!isSpecificPlace(where)) {
      pendingReports.set(key, { kind, text });
      return "Thanks for flagging that. Where exactly is it? (e.g. \"SSA north ramp\" or \"JSOM east elevator\")";
    }
    return fileReport(kind, where, text, ctx);
  }

  // --- Routes. People text like people: "im at the student center",
  //     "idk where to go", "take me to the library", "union to jsom".
  const known = (p: string) => resolve_location({ phrase: p }).candidates.length > 0;
  const clean = (p: string) => p.replace(/[?.!]+$/, "").trim();

  const here = text.match(/\b(?:i'?m|im|i am|currently)\s+(?:at|in|near|by|outside)\s+(.+?)(?:[,.!?]|\s+and\b|$)/i);
  if (here && known(here[1])) origins.set(key, clean(here[1]));

  let from: string | undefined, to: string | undefined;
  const fromTo = text.match(/from\s+(.+?)\s+to\s+(.+)/i);
  const bare = text.match(/^(.+?)\s+to\s+(.+)$/i);
  const toOnly = text.match(/\b(?:to|get to|getting to|go to|going to|take me to|directions to|route to|need to get to|heading to|how do i get to)\s+(?:the\s+)?(.+)$/i);
  if (fromTo && known(fromTo[1]) && known(fromTo[2])) [from, to] = [fromTo[1], clean(fromTo[2])];
  else if (bare && known(bare[1]) && known(bare[2])) [from, to] = [bare[1], clean(bare[2])];
  else if (toOnly && known(toOnly[1]) && !(here && toOnly.index! < here.index!)) [from, to] = [origins.get(key) ?? "", clean(toOnly[1])];
  else if (!here && known(text) && origins.has(key)) [from, to] = [origins.get(key)!, clean(text)];

  const notOnMap = (p: string) =>
    `I don't have "${clean(p)}" on my map yet. I'm still learning campus 🗺️ Right now I cover ${COVERED}. Want a route to one of those?`;
  if (!to && toOnly && !known(toOnly[1])) return notOnMap(toOnly[1]);
  if (!to && fromTo && known(fromTo[1]) && !known(fromTo[2])) return notOnMap(fromTo[2]);

  if (to && !from) {
    return `Happy to help you get to ${to}. Where are you starting from? (e.g. "I'm at the Student Union")`;
  }
  if (!from || !to) {
    if (here && known(here[1])) {
      return `Got it, you're at ${place(resolve_location({ phrase: here[1] }).candidates[0].id)} 📍 Where do you want to go?\n` +
        "A few step-free spots: McDermott Library, JSOM, the Student Union, ECSW.";
    }
    const placey = /\b(hall|building|bldg|dorm|dorms|center|centre|library|fountain|garage|lot|gym|rec|cafe|commons|residence|apartments?|plaza|lab|ate|ssb|jo|ecs[sw]?|founders|green|union|parking)\b/i;
    if (text.split(/\s+/).length <= 4 && (placey.test(text) || origins.has(key))) {
      return `I don't have "${clean(text)}" on my map yet. I'm still learning campus 🗺️ Right now I cover ${COVERED}. Want a route to one of those?`;
    }
    if (/idk|don'?t know|not sure|lost|where (should|do) i/i.test(text)) {
      return "No worries! Tell me where you are (e.g. \"I'm at the Student Union\") and where you're headed, and I'll find a step-free way.";
    }
    return helpOnce(key);
  }

  const r: any = await find_accessible_route({ from, to });
  if (r.error === "same_place") return notOnMap(to);
  if (r.error) return `I couldn't find "${r.error === "unknown_location" ? to : from}" on my map yet. Try a building name like "library" or "JSOM".`;
  if (!r.ok) return `I don't see a step-free way from ${r.from} to ${r.to} right now. Every known path needs stairs or is blocked by a verified report.`;
  origins.set(key, to); // after arriving, "now the union" starts from here
  const extra = r.extra_minutes_vs_typical_maps > 0 ? `, ${r.extra_minutes_vs_typical_maps} min longer than a normal maps route` : "";
  const stairs = r.stairs_on_typical_maps_route > 0 ? ` A normal maps app would send you up ${r.stairs_on_typical_maps_route} set${r.stairs_on_typical_maps_route > 1 ? "s" : ""} of stairs.` : "";
  const avoid = r.avoiding_reports?.length ? `\nAvoiding: ${r.avoiding_reports.join(", ")}.` : "";
  const careful = r.unconfirmed_reports_on_route?.length ? `\nHeads up (unconfirmed): ${r.unconfirmed_reports_on_route.join(", ")}.` : "";
  return `${r.from} → ${r.to}: about ${r.minutes} min, ${r.meters} m${extra}.${stairs}\n` +
    r.directions.map((d: string, i: number) => `${i + 1}. ${d}`).join("\n") + avoid + careful +
    `\n${r.verified_segments} segments recently verified. Tell me if anything's off.`;
}

/** Words that describe a kind of spot but not which one ("the ramp", "an elevator"). */
const GENERIC = /\b(the|a|an|ramp|ramps|elevator|elevators|lift|door|doors|entrance|entrances|stairs|steps|path|walkway|sidewalk|it|there|here|this|that|one)\b/gi;

/** True when the phrase names an actual place on the map, not just a kind of feature. */
function isSpecificPlace(phrase: string): boolean {
  if (!phrase.replace(GENERIC, " ").replace(/[^a-z0-9]/gi, "").length) return false;
  return resolve_location({ phrase }).candidates.length > 0;
}

async function fileReport(kind: ReportCategory, where: string, note: string, ctx: ToolContext): Promise<string> {
  const r: any = await submit_report({ place: where, category: kind, note }, ctx);
  if (!r.ok) return "I couldn't place that on my map. Can you name the building and the spot (ramp, elevator, door)?";
  return `Got it: ${r.what.toLowerCase()} at ${r.where} is now on the live map as unverified${r.has_photo ? " with your photo" : ""}. ` +
    "Once someone else confirms it, I reroute everyone around it. Thank you 💛";
}

async function think(key: string, text: string, ctx: ToolContext): Promise<string> {
  if (!HAS_MODEL) return fallbackReply(text, ctx, key);
  try {
    const { reply, steps, history } = await runBeau(text, histories.get(key) ?? [], ctx);
    histories.set(key, history.slice(-16));
    if (steps.length) console.log(`[beau]   tools: ${steps.join(" → ")}`);
    return reply || (await fallbackReply(text, ctx, key));
  } catch (err) {
    console.error("[beau] model failed, using fallback:", (err as Error).message);
    return fallbackReply(text, ctx, key);
  }
}

/** Pull text and image attachments out of any message shape. */
/** Loop 1's core: decide Beau's reply to one message. */
export async function respond(inc: Incoming): Promise<string> {
  const text = inc.text.trim();
  // Remember who this is, so alerts and verification questions can reach them later.
  const subscriber = await store
    .upsertSubscriber({ platform: inc.platform, handle: inc.handle, space_id: inc.spaceId, agent_user_id: inc.agentUserId })
    .catch((err) => { console.error("[beau] subscriber save failed:", err.message); return undefined; });
  const key = subscriber?.id ?? inc.spaceId;
  const ctx: ToolContext = {
    subscriber,
    source: inc.platform === "sms" || inc.platform === "email" ? inc.platform : "imessage",
    pendingPhotoUrl: pendingPhotos.get(key),
  };

  let reply: string;
  const word = text.toLowerCase().replace(/[^a-z]/g, "");

  // 1. A photo: keep it until we know where it is.
  for (const load of inc.photos) {
    const url = await savePhoto(load);
    if (url) { pendingPhotos.set(key, url); ctx.pendingPhotoUrl = url; }
  }

  if (word === "stop" || word === "start") {
    // 2. Opt out / back in. Always honoured, no model in the loop.
    const on = word === "start";
    if (subscriber) await store.updateSubscriber(subscriber.id, { alerts: on });
    reply = on
      ? "Alerts are back on. I'll text you if something breaks on your route ✨"
      : "Done, no more alerts or questions from me. Text START anytime to turn them back on.";
  } else if (subscriber && /^(yes|yeah|yep|y|stillthere|no|nope|n|clear|gone|itsgone)$/.test(word)) {
    // 3. An answer to "is it still there?" — the human-in-the-loop check.
    const ask = await store.pendingAsk(subscriber.id);
    if (!ask) {
      reply = await think(key, text, ctx);
    } else {
      const agrees = /^(yes|yeah|yep|y|stillthere)$/.test(word);
      await store.answerAsk(ask.id, agrees ? "yes" : "no");
      const r = await store.voteReport(ask.report_id, agrees, beauUserId(ctx));
      reply = !r ? "Thanks! That report was already cleared."
        : r.verified ? "Thanks, that makes it verified ✅ I'm rerouting everyone around it now."
        : r.resolved ? "Thanks! Enough people say it's clear, so I've taken it off the map."
        : agrees ? "Thanks for confirming."
        : "Thanks, noted as possibly cleared. I'll keep asking around.";
    }
  } else if (!text && ctx.pendingPhotoUrl) {
    // 4. Photo with no words.
    reply = "Got your photo 📸 Where is this, and what's wrong? (e.g. \"library ramp, blocked\")";
  } else if (!text) {
    reply = HELP;
  } else if (/^help\b/i.test(text)) {
    helped.add(key); reply = HELP;
  } else if (/^(hi|hey|hello|start over|menu)\b/i.test(text) && text.length < 24) {
    reply = helpOnce(key);
  } else {
    // 5. Everything else goes to Beau (Nemotron + tools), with a rule-based net.
    reply = await think(key, text, ctx);
  }

  if (ctx.usedPhoto) pendingPhotos.delete(key);
  return reply;
}


/** Unsolicited texts are rate-limited per person; Photon also refuses them on
 *  a shared line until that person has texted Beau, which is our opt-in. */
async function nudge(deliver: Deliver, s: store.Subscriber, text: string, key: string) {
  const last = lastNudge.get(s.id) ?? 0;
  if (Date.now() - last < NUDGE_GAP_MS) return false;
  try {
    await deliver(s, text, key);
    lastNudge.set(s.id, Date.now());
    console.log(`[beau] ⇢ ${s.handle}: ${text.split("\n")[0]}`);
    return true;
  } catch (err) {
    console.error(`[beau] couldn't reach ${s.handle}:`, describe(err));
    return false;
  }
}

async function onNewReport(deliver: Deliver, r: store.BeauReport) {
  const subs = await store.alertSubscribers();
  const open = await store.openReports();
  const without = open.filter((x) => x.id !== r.id);
  const where = r.locationLabel;
  const touched = new Set<string>();

  // a) People whose watched route this report changes get a reroute.
  for (const s of subs) {
    if (!s.saved_from || !s.saved_to || `beau:${s.id}` === r.reporterId) continue;
    // Treat the new report as blocking for the alert, even before it's confirmed:
    // we're warning them about it, so the reroute should steer clear if it can.
    const asBlocking = [...without, { ...r, confirmations: Math.max(1, r.confirmations), disputes: 0 }];
    const before = planRoute(s.saved_from, s.saved_to, DEFAULT_PREFS, without).recommended;
    if (!before?.edgeIds.includes(r.edgeId ?? "")) continue; // not on their route
    const after = planRoute(s.saved_from, s.saved_to, DEFAULT_PREFS, asBlocking).recommended;
    const msg = after
      ? `Heads up: ${KIND_TEXT(r.category)} was just reported at ${where}, on your route to ${place(s.saved_to)}.\n` +
        `New step-free route, about ${after.minutes} min:\n` + routeLines(after).map((l, i) => `${i + 1}. ${l}`).join("\n")
      : `Heads up: ${KIND_TEXT(r.category)} was just reported at ${where}, and I can't find another step-free way to ${place(s.saved_to)} right now. Want me to look for the nearest alternative entrance?`;
    if (await nudge(deliver, s, msg, `alert:${r.id}:${s.id}`)) touched.add(s.id);
  }

  // b) Ask up to two other people to verify. Humans check what the community
  //    reported; one confirmation from someone else makes it a hard block.
  const askable = subs.filter((s) => `beau:${s.id}` !== r.reporterId && !touched.has(s.id)).slice(0, 2);
  for (const s of askable) {
    const msg =
      `Quick check from Beau: someone reported ${KIND_TEXT(r.category)} at ${where}` +
      `${r.photoUrl ? " (with a photo)" : ""}. If you're nearby, is it still there? Reply YES or NO.\n` +
      "(Text STOP to pause these.)";
    if (await nudge(deliver, s, msg, `ask:${r.id}:${s.id}`)) await store.createAsk(r.id, s.id);
  }
}

/** Loop 2: when a report lands (text OR web), alert and ask for verification. */
export async function watchReports(deliver: Deliver): Promise<never> {
  let since = new Date().toISOString();
  while (true) {
    try {
      for (const r of await store.reportsSince(since)) {
        since = r.createdAt;
        console.log(`[beau] new report (${r.source}): ${r.category} at ${r.locationLabel}`);
        await onNewReport(deliver, r).catch((err) => console.error("[beau] alert pass failed:", describe(err)));
      }
    } catch (err) {
      console.error("[beau] watcher failed:", describe(err));
    }
    await sleep(WATCH_MS);
  }
}
