# Beacon ✨
**A brighter way forward.**

Beacon is an AI-powered accessibility navigation app for wheelchair users and people with mobility limitations. It finds the fastest *accessible* route across campus, routes around reported obstacles, and lets the community report and verify accessibility issues in real time.

Meet **Beau**, our firefly guide. Text Beau on iMessage to get accessible directions or report an obstacle in plain words.

Built at **HackUTD 2026**.

---

## 💡 The problem
Regular map apps assume everyone can take the stairs. For wheelchair users, a single broken elevator, a blocked ramp, or a stepped entrance can turn a 5-minute trip into a 30-minute detour, and that information is usually out of date or missing.

## 🌟 Features
- **Accessible routing**: step-free, avoid stairs, avoid elevators, or prefer ramps
- **Live obstacle avoidance**: confirmed reports block a path and Beacon reroutes automatically
- **Honest routes**: every route shows how many segments are verified, and unverified paths are never shown as guaranteed accessible
- **Community reporting**: report broken elevators, blocked ramps, construction and more in about 20 seconds
- **Community verification**: confirm or dispute reports (Unverified, Confirmed, Disputed, Resolved)
- **Beau on iMessage**: directions and reports by text, powered by Photon 2.0 + OpenAI
- **3D campus map**: neon tilted view, with a 2D mode for panning
- **Accessibility first**: Clarity Mode, adjustable text size, extra-large tap targets, reduced motion

## 🛠️ Tech stack
| Part | Technology | Purpose |
| --- | --- | --- |
| Frontend | Next.js + TypeScript | Website and app |
| Styling | Tailwind CSS | Neon design and accessibility modes |
| Maps | MapLibre GL + OpenStreetMap (OpenFreeMap tiles) | Interactive 3D campus map |
| Routing | Dijkstra's algorithm | Find accessible paths |
| Database | Supabase | Store obstacles, routes, reports |
| AI | NVIDIA Nemotron or OpenAI | Beau's reasoning and tool calling |
| Messaging | Photon 2.0 | Send and receive iMessages |
| Hosting | Vercel | Publish the website |
| Version control | Git + GitHub | Share code with the team |

## ⚙️ How it works
1. The campus is modeled as a graph of walkways, entrances, ramps, elevators and stairs.
2. Each path costs its length, adjusted by your preferences and by community reports:
   - Confirmed obstacle: blocked
   - Unverified obstacle: avoided when possible
   - Disputed obstacle: small penalty
3. Dijkstra's algorithm finds the best route, and a second pass finds an alternative.
4. Reports from the app and from Beau go into the same Supabase tables, so everyone sees the same map.

## 🚀 Getting started
1. `git clone` this repo and `cd` into it
2. `npm install`
3. Copy `.env.example` to `.env.local` and add your Supabase keys (optional: demo data works without them)
4. `npm run dev`, then open http://localhost:3000
5. For the database, run `supabase/schema.sql` in the Supabase SQL editor (see `docs/SUPABASE_SETUP.md`)

### Run Beau (iMessage)
Beau lives in `agent/` and shares the website's campus map, router and Supabase tables, so a report texted to Beau appears on the map live.
1. In `.env.local`, also set `SUPABASE_SERVICE_ROLE_KEY`, a model key (`NVIDIA_API_KEY` or `OPENAI_API_KEY`) and your Photon keys
2. `npm run imessage:beta` (Photon 2.0 beta API) or `npm run imessage` (Photon Spectrum)
3. Test without a phone: `npm run beau -- "route from the union to jsom"`

Details: `agent/README.md`

## 🌿 Branches
- `main`: stable, demo-ready code
- `integration`: website + Beau combined, on one shared database (merge this into `main`)
- `frontend`: Next.js app (UI, map, routing)
- `backend`: original Photon 2.0 messaging agent (now moved into `agent/` on `integration`)

## 🗺️ What's next
- Live GPS turn-by-turn navigation
- True 3D buildings with MapLibre GL
- Indoor routing across floors and elevators
- Expanding beyond UTD to more campuses and cities

## 👥 Team
- Aanya Kochhar
- Preethi Seereddy
- Ishwarya Mekala
- Sreehaasika Katuru 

---
*Made with 💚 at HackUTD 2026*
