# Beau — the agent layer

> **Integrated with the website.** Beau lives in the same repo as the Next.js app and
> shares its code and data:
>
> | Shared piece | File | Effect |
> |---|---|---|
> | Campus graph | `src/lib/campus.ts` | Beau knows exactly the buildings, entrances, ramps and elevators the map shows |
> | Router | `src/lib/routing.ts` | Beau's directions are identical to the website's |
> | Report status rules | `src/lib/status.ts` | "Confirmed" means the same thing over text and on the map |
> | Tables | `supabase/schema.sql` | Beau writes `reports` (with `source = 'beau'`) and `report_votes`; the map updates live via Realtime |
>
> Beau also uses two tables of its own, `subscribers` and `verification_asks` (phone numbers, server-only).
>
> Try it without iMessage: `npm run beau -- "route from the union to jsom"` (needs a model key).

Two surfaces, one brain:

- **Photon 2.0** delivers it over iMessage.
- **NVIDIA Nemotron** does the reasoning and tool selection.

They are not competing choices — Photon is transport, Nemotron is the model.
Using both is what makes you eligible for both tracks with one build.

## The loop

```
iMessage ──Photon──▶ agent ──▶ Nemotron (tool calling)
                       │           │
                       │           ├─ resolve_location
                       │           ├─ find_accessible_route ──▶ src/lib/routing.ts (the website's router)
                       │           ├─ submit_report ──────────▶ Supabase
                       │           └─ save_preference
                       ▼
              reply ──Photon──▶ iMessage
```

The model never does arithmetic on the graph. It decides *which* tool, with
*what* arguments, and how to explain the result. The router in `src/lib/routing.ts`
is the source of truth for every number the user sees.

## Why this clears NVIDIA's "beyond a chatbot" bar

| Their requirement | Where it shows up |
|---|---|
| Not just responding to prompts | Every answer comes from a tool call, not from the model's own knowledge |
| Multi-step workflows | "the ramp by the library is blocked" → `resolve_location` → clarifying question → `submit_report` → re-route affected users |
| Tool integration | Supabase, the router, and the campus graph |
| Real-world applicability | Wheelchair users on a campus that has actual broken elevators |

## Setup

Nemotron speaks the OpenAI format, so any OpenAI client works:

```ts
const res = await fetch(`${process.env.NVIDIA_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: process.env.NEMOTRON_MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    tools: TOOLS,
  }),
});
```

Get a key at build.nvidia.com. Keep it server-side — never prefix it with `NEXT_PUBLIC_`. Prefer OpenAI? Set `OPENAI_API_KEY` instead (and leave `NVIDIA_API_KEY` empty).

## Running Beau on iMessage (Photon 2.0 beta API)

Beau is built on the **Photon 2.0 beta HTTP API** via the official client
`@photon-ai/api`. One process runs two loops:

| Loop | Photon 2.0 calls | What it does |
|---|---|---|
| Inbox | `listMessages`, `sendMessage` (text, `message.read`, `space.typing.update`), `getAttachment`, `downloadAttachment` | Answers texts and photos; files reports; YES/NO verification answers; STOP/START |
| Watcher | `sendMessage` into existing spaces | When a report lands (text **or** web), texts people whose watched route it breaks, and asks up to two others to verify it |

Every send uses an idempotency key, so retries never double-text anyone.
Unsolicited texts are rate-limited (one per person per 10 minutes) and only go
to people who texted Beau first, which is their opt-in. STOP always works.

Setup:
1. Photon 2.0 dashboard → create a project → **Settings** → copy the Project ID (`pho_prj_…`).
2. **API keys** → New key with `project:read` + `project:write`.
3. **iMessage** → add each tester's own number → assign a shared-pool number (that's Beau's number).
4. Put `PHOTON_PROJECT_ID` and `PHOTON_API_KEY` in `.env.local` (plus `SUPABASE_SERVICE_ROLE_KEY` and `NVIDIA_API_KEY` or `OPENAI_API_KEY` if you have them).
5. `npm run imessage:beta`, then text Beau's number from an assigned phone. (Using the Spectrum dashboard at app.photon.codes instead? Set `SPECTRUM_PROJECT_ID` / `SPECTRUM_PROJECT_SECRET` and run `npm run imessage`.)

Without `NVIDIA_API_KEY`, Beau still handles routes and reports with a
rule-based parser. Without Supabase, state lives in memory and the web map
won't see texted reports.

## Chat with Beau without Photon

```
npm run beau:chat
```

Same brain and same replies as iMessage, right in the terminal. Works with no keys at all (rule-based replies). Add `NVIDIA_API_KEY` or `OPENAI_API_KEY` for the AI brain, and the Supabase keys so reports reach the website map. Handy as a backup demo if Photon or Wi-Fi acts up.

## Beau isn't texting back?

Run the self-check first. It tests every piece and never prints your secrets:

```
npm run beau:check
```

The usual causes, in order:

1. **Beau isn't running.** `npm run imessage:beta` (or `npm run imessage`) must stay open in a terminal the whole time. Closing it, pressing Ctrl+C, or the laptop sleeping stops Beau.
2. **Wrong script for your dashboard.** Keys from app.beta.photon.codes → `npm run imessage:beta`. Keys from app.photon.codes → `npm run imessage`.
3. **Your phone isn't registered.** Photon only delivers texts from numbers added under iMessage in the dashboard, sent to the pool number assigned to the project.
4. **Node is too old.** The scripts need Node 22.9 or newer (`node -v`).
5. **Texts arrive but get skipped.** The terminal now prints a `[beau] skipped …` line with the reason. Send that line to whoever owns `agent/photon.ts`.

Each text Beau receives prints `[beau] ← …` and each reply prints `[beau] → …`. If you see neither, Photon isn't delivering the text (causes 1–3).
