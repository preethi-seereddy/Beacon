# Beacon ✨

**A brighter way forward.** Accessible campus navigation for wheelchair users and people with mobility limitations. HackUTD 2026.

Beacon finds the fastest *accessible* route across campus, avoids obstacles the community has reported, and lets anyone report or verify issues. Beau the firefly is the AI companion, available over iMessage through Photon 2.0.

## Stack

| Part | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + a small set of component classes in `src/app/globals.css` |
| Maps | React Leaflet + OpenStreetMap |
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

Leaflet is a 2D library, so the 3D look comes from two tricks:

- A CSS perspective tilt on the map.
- Buildings drawn as stacks of slightly offset polygons, which looks like extrusion.

While tilted, dragging is turned off because Leaflet's pointer math doesn't account for the transform. Markers stay tappable. The cube button on the map, or Settings → 3D map, switches to 2D for free panning.

For true 3D buildings later, swap `CampusMap.tsx` for MapLibre GL with OSM vector tiles.

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
  components/          BottomNav, CampusMap (Leaflet), MapView, Beau, Skyline, Icon, ui
  lib/
    campus.ts          walkway graph + buildings (edit coordinates here)
    routing.ts         Dijkstra, alternatives, directions, nearest edge/node
    data.ts            reports API (Supabase or local demo store)
    settings.tsx       preferences, display settings, favorites, recents, location
    status.ts          report status rules + labels
supabase/schema.sql    database schema
```
