# Beacon ✨

**A brighter way forward.** Accessible campus navigation for wheelchair users and people with mobility limitations. HackUTD 2026.

Beacon finds the fastest *accessible* route across campus, avoids obstacles the community has reported, and lets anyone report or verify issues. Beau the firefly is the AI companion, available over iMessage through Photon 2.0.

## Stack

| Part | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + a small set of component classes in `src/app/globals.css` |
| Maps | MapLibre GL + OpenStreetMap vector tiles (OpenFreeMap) |
| Routing | Dijkstra's algorithm (`src/lib/routing.ts`) |
| Database | Supabase (`supabase/schema.sql`) |
| AI / Messaging | OpenAI + Photon 2.0, on the backend. This repo is the frontend. |
| Hosting | Vercel |

## Run it

```bash
npm install
cp .env.example .env.local   # optional — see below
npm run dev                  # http://localhost:3000
```

The app works without any keys. If the Supabase variables are empty, reports are stored in the browser (localStorage) and seeded with demo reports.

### Connect Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor. It creates the `reports` and `report_votes` tables, the `reports_with_counts` view, and the `report-photos` storage bucket.
3. Put the project URL and anon key in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

The Photon/Beau backend should write to the same tables (`source = 'beau'`). That way, a report texted to Beau appears on the map. It should also set `edge_id`, using the same nearest-walkway logic as `nearestEdge()` in `src/lib/routing.ts`.

### Connect Beau

Set `NEXT_PUBLIC_BEAU_IMESSAGE` to the phone number or email your Photon agent answers on. The "Message Beau" button opens Messages with "hi Beau" pre-filled.

## Deploy (Vercel)

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add the same environment variables.
4. Deploy. No other config needed.

## ⚠️ Before the demo: fix the campus coordinates

`src/lib/campus.ts` holds the walkway graph: junctions, entrances and edges flagged for stairs, ramps and elevators, plus building footprints. The coordinates are **approximate placeholders around UT Dallas**, not surveyed data.

To fix them:

1. Open `/map?debug=1`. This forces the 2D view.
2. Tap a real entrance or path corner. The coordinates are copied to your clipboard.
3. Paste them into `campus.ts`.

Routing, directions, the "obstacles avoided" logic, and report snapping all update automatically.

## How routing works

- Every walkway edge costs its length in meters.
- If the user wants step-free or no stairs, stair edges are impassable.
- Avoiding elevators multiplies elevator edges by 5. Preferring ramps multiplies ramp edges by 0.8. Unverified edges cost 1.25×.
- Community reports change the cost of the edge they sit on:
  - Confirmed: blocked.
  - Unverified: 4×, so it's avoided when a reasonable alternative exists.
  - Disputed: 1.6×.
  - Resolved: no effect.
- The alternative route is a second Dijkstra run with the recommended route's edges penalized 3×.
- The app never calls a route "accessible" without showing how many of its segments are verified.

Report status rules are in `src/lib/status.ts`.

## The 3D map

The map uses MapLibre GL with free OpenStreetMap vector tiles from OpenFreeMap (no API key). Buildings are real 3D extrusions from OpenStreetMap's footprints and heights, and the destination building glows mint. In 3D you can still pan, zoom and rotate (two-finger twist on phones, right-drag or Ctrl+drag on desktop). The cube button switches between the tilted 3D view and a flat 2D view.

If the vector tiles can't load, the map falls back to raster OSM tiles plus Beacon's own building outlines.

`/map?debug=1` draws the walkway graph (yellow lines, stairs in pink, entrances in mint) over the real map, so you can see where `src/lib/campus.ts` is off and tap to copy accurate coordinates.

## Nav animations

Each tab animates when tapped (in `BottomNav.tsx` and `globals.css`):

- **Home**: the house glows for a second.
- **Map**: the path dots light up one by one, then the destination pin lights up.
- **Report**: the lightbulb flashes on.
- **Profile**: Beau's wings flutter.

The animations are skipped when Reduce Motion or Clarity Mode is on, or when the device's reduced-motion setting is on.

## Accessibility

- Clarity Mode: high contrast, no glow, no animation.
- Adjustable text size.
- Extra-large tap targets.
- High-contrast map.
- Status is always shown with an icon plus a text label, never color alone.
- Real buttons, links and labels throughout.

All of these settings are saved per device.

## Project layout

```
src/
  app/                 pages: / search map route report reports/[id] community
                       profile profile/preferences beau settings
  components/          BottomNav, CampusMap (MapLibre 3D), MapView, Beau, Skyline, Icon, ui
  lib/
    campus.ts          walkway graph + buildings (edit coordinates here)
    routing.ts         Dijkstra, alternatives, directions, nearest edge/node
    data.ts            reports API (Supabase or local demo store)
    settings.tsx       preferences, display settings, favorites, recents, location
    status.ts          report status rules + labels
supabase/schema.sql    database schema
```

## Points & leaderboard

Points reward verified, useful help, not volume:

- **+10** when someone else confirms your report
- **+5** bonus when that report is later marked fixed
- **+2** for each report you confirm or dispute

Unconfirmed reports earn nothing, so spamming reports never wins. Levels go Spark → Glow → Lantern → Lighthouse → Beacon, and badges unlock for first check, 5 checks, a confirmed report, and 60 points.

With Supabase connected, the `leaderboard` view in `supabase/schema.sql` computes this for everyone, including people who report through Beau. Without Supabase, the board shows demo contributors plus you.
