# Drive Through My Career — Anshuman Talukdar

An interactive 3D portfolio: drive a little coral wagon around a low-poly island at golden hour and pull up at landmarks to read about my work. Every section is also available as a plain, server-rendered page at `/portfolio`.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start   # production
```

Other checks:

```bash
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # eslint (Next + React Compiler rules)
npm run check:world  # bakes the island in Node and validates layout: roads drivable, destinations inside the coast, slopes
```

No environment variables are required. Optionally set `NEXT_PUBLIC_SITE_URL` (e.g. `https://yourdomain.com`) so Open Graph image URLs are absolute.

## What's on the island

| Place | Panel | Where |
| --- | --- | --- |
| **Home Base** (log cabin with smoking chimney) | About me, résumé download | South, next to the start |
| **Project Garage** (neon-trimmed workshop + six project kiosks — click one) | Featured projects | East |
| **Skills Grove** (ring of monoliths, one per skill category, campfire + fireflies) | Technical skills | North |
| **Experience Tower** (lookout on a hill; career milestone signs line the road up) | Timeline | North-west |
| **Contact Lighthouse** (rotating beam, keeper's hut) | Email, GitHub, links | West peninsula |
| **Hidden Terminal** (off the dirt path in the northern woods, not on the map) | A small Easter egg | — |

Each destination has a glowing landing pad. Drive onto it and press **E** (or tap the prompt).

**Controls:** W/↑ accelerate · S/↓ brake then reverse · A/D steer · Space handbrake · E enter · R reset to the last on-road spot · M map · Esc close. The camera is locked at a fixed angle. On touch devices you get a steering pad and pedals.

## Architecture

```
app/                    layout (fonts, metadata), / (3D shell), /portfolio (static content), icon, OG image
data/                   ← all professional content lives here
  profile.ts            name, headline, summary, links, résumé path, education
  experience.ts         roles (most recent first) + date helpers; years of experience is computed
  projects.ts           projects; first six get a kiosk in the garage automatically
  skills.ts             categories; "used at" evidence is computed from experience/projects
  locations.ts          destinations: position, radius, colour, panel, prompt text
lib/
  world/layout.ts       hand-tuned island: coastline, lake, stream, road control points, pads, hills
  world/terrain.ts      bakes a 257×257 heightfield once; roads/bridge/stream/lake are stamped in
  world/colliders.ts    static circle/box colliders in a spatial hash
  world/scatter.ts      seeded, deterministic placement of trees, grass, flowers, rocks
  world/structures.ts   building placements (+ their colliders)
  vehiclePhysics.ts     arcade car: fixed 120 Hz step, bicycle-model yaw, grip, slopes, collisions
  vehicleState.ts       high-frequency mutable state (no React re-renders per frame)
  store.ts              zustand UI state (phase, panels, waypoint, quality, sound…)
  audio.ts              procedural Web Audio (wind, water, birds, engine, chimes) — no audio files
components/world/       React Three Fiber scene: terrain, roads, water, vegetation, buildings, car, camera, effects
components/portfolio/   HTML UI: intro, HUD, panels/dialog, map, touch controls, loading, fallback, content blocks
hooks/useDrivingControls.ts  keyboard input (ignores typing, releases on blur)
```

Notable decisions:

- **No physics engine.** I chose a deterministic arcade controller over Rapier: it's tuned for comfortable handling, has no ~2 MB WASM download, and drives on the exact heightfield the terrain mesh is built from. Tuning knobs are in `vehicleConfig` in `lib/vehiclePhysics.ts`.
- **Everything is procedural.** Terrain, buildings, car, vegetation and sky are generated from code with a fixed seed, so there are no external models to break and the island is identical on every load. The only fetched assets are a 27 KB font for in-world signs and the résumé PDF.
- **Instancing everywhere.** Trees, grass, flowers, rocks, lamps and bridge parts are `InstancedMesh`es with wind sway in the vertex shader, so the whole forest costs a handful of draw calls.
- **Quality:** Auto/High/Low (gear icon). Auto starts from a device guess (phones and ≤4-core machines start on Low) and steps down if the frame rate drops. Low turns off shadows and antialiasing and cuts grass, flowers, particles and render resolution. If the frame rate stays very low, a notice offers the classic view.
- **Resilience:** no WebGL, or a lost context, means the full content view renders instead. Renderer creation steps down through safer context settings (it no longer fails on GPUs that reject MSAA). A crash in the 3D scene is caught by an error boundary. Audio is created only after the visitor turns sound on.

## Updating content

Edit the files in `data/` — the 3D world reads from them, nothing is hardcoded in the scene.

- **Add a project:** append to `data/projects.ts`. Optional fields (`problem`, `contribution`, `challenges`, `outcomes`, `liveUrl`, `sourceUrl`, `image`) only render when present. Use `todo` for anything you still need to fill in; it shows as a subtle "To add" note.
- **LinkedIn:** set `linkedin` in `data/profile.ts`. It's `null` because the résumé doesn't include one.
- **Phone:** stored but hidden. Set `showPhone: true` to display it.
- **Résumé:** replace `public/resume.pdf`, or change `resumePath`.
- **Move a destination:** change its `position` in `data/locations.ts`, the matching pad in `lib/world/layout.ts` (`PADS`) and the building in `lib/world/structures.ts`, then run `npm run check:world`.

## Replacing visuals and audio

- **Models:** each landmark is a component in `components/world/Buildings.tsx`, and the car is `CarModel` in `Vehicle.tsx`. To use a GLB, drop it in `public/models/` and swap the component's JSX for drei's `useGLTF` (keep the same position/yaw from `structures.ts` so colliders still match).
- **Colours:** `components/world/materials.ts` (`palette`), the sky and fog in `Atmosphere.tsx`, the UI tokens in `app/globals.css` (`@theme`).
- **Audio:** sound is synthesised in `lib/audio.ts`. To use recordings instead, load them there with `AudioBuffer`s and keep the same `audio.*` API.

## Deploying

It's a fully static Next.js 16 app (every route prerenders), so it deploys as-is to Vercel (`vercel` / import the repo) or any Node host with `npm run build && npm start`. Set `NEXT_PUBLIC_SITE_URL` to your domain.

## Content sources and caveats

- All career facts come from `Anshuman-Talukdar-resume.html` / `.pdf` (they match). Role tech lists were de-duplicated and split where words had run together ("Expo Tailwind CSS" → Expo, Tailwind CSS).
- Years of experience (6+) is computed from role dates and includes freelance work from 2020.
- The GitHub profile URL is derived from the repository links on the résumé. Mira's live URL comes from its GitHub repo metadata.
- Design Wave and Mira have no descriptions on GitHub, and the Medusa link points to the repo rather than a specific PR. Each is marked with a "To add" note.
- `public/resume.pdf` includes your phone number. The website itself does not display it.
