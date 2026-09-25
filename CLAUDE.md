# Universe Map

Interactive 3D visualization of the Solar System and Milky Way galaxy, with live positions and time travel.

## Stack

- **React 19 + TypeScript + Vite** (SWC plugin, port 5317)
- **Three.js** via React Three Fiber (`@react-three/fiber`) + Drei
- **Tailwind CSS v4** (Vite plugin, no PostCSS config)
- **Vitest** (unit) + **Playwright** (smoke tests on the production build), run in `.github/workflows/ci.yml`
- Client-side only (static files + cron-refreshed JSON on the server)

## Commands

```bash
npm run dev       # Vite dev server on :5317 (--host 0.0.0.0)
npm run build     # tsc -b && vite build (three.js and other libraries in separate cached chunks)
npm run lint      # ESLint — keep it at 0 errors, 0 warnings
npm test          # Vitest: orbital model vs JPL Horizons fixtures, scale rules
npm run test:e2e  # Playwright smoke tests against `vite preview` (build first); uses local Chrome, CI installs Chromium
```

## Architecture

### Coordinate System

Ecliptic J2000, **Z-up**. Camera up = `[0, 0, 1]` (never changed: OrbitControls relies on it). Positions in km from NASA JPL Horizons. `KM_PER_UNIT = 6371` (1 Three.js unit = 1 Earth radius).

### Positions over time (`helper/kepler.ts`, `ephemeris.ts`, `moonTheory.ts`)

`public/data/orbits.json` (written by `scripts/fetch-ephemeris.mjs`, daily cron in production) holds:
- **elements**: osculating Keplerian elements at "now" for planets (giant planets and Pluto via their system barycenter), Ceres and moons (relative to their planet). The mean motion is fitted over a window when it spans a full orbit (moons: absorbs precession), otherwise osculating (slow Sun-orbiting bodies).
- **trajectories**: spacecraft position samples (Voyager 1/2, New Horizons heliocentric; JWST relative to Earth).

`createEphemeris(data)` → `relative(body, t)` / `heliocentric(body, t)` for any instant. Earth and Pluto are offset from their barycenter by their big moon (`barycenter` field). The Moon uses Kepler within a day of the epoch, the Astronomical Almanac low-precision theory beyond (≈0.1°). Accuracy vs Horizons is covered by `src/__tests__/ephemeris.test.ts` (fixtures from `scripts/fetch-test-fixture.mjs` — regenerate both fixtures together).

### Scale System

Two modes blended via `blend` (0 = log, 1 = realistic):
- **Log mode**: distances `d^0.3` (Sun-orbiting bodies). Radii boosted 3x but capped at 5 units (monotonic). Moons: `d^0.2` measured from the planet's surface (Saturn: ring edge).
- **Realistic mode**: true km-to-unit conversion.

`blend` lives in a **ref** (`ScaleContext.blendRef`), eased by `ScaleProvider` (time-based, ~1 s). Never make it React state: 3D components read it in `useFrame`.

`helper/bodyPosition.ts` → `scenePosition(body, ephemeris, t, blend)` is the single source of scene positions (bodies, orbits, labels, camera all use it).

### Time (`TimeProvider`)

Simulated clock derived from an anchor (`sim = anchorSim + (real − anchorReal) × rate`). `getTime()` returns a value frozen once per frame by `<SimClock>` (`useFrame` priority −10): at high speeds bodies move a lot per millisecond, so everything in a frame must use the same instant. `live` = following the real clock. Speeds in `helper/timeSpeeds.ts`.

### Selection & navigation

- `SelectionProvider`: selected body ↔ `?body=<map slug>` (pushState; popstate flies back). `select(body, { fly })`. Panel open state lives here too.
- `CameraNavigationContext`: `flyTo` / `viewSnap` requests consumed by `CameraRig`.
- `helper/bodies.ts`: lookups by id/slug, parent map, breadcrumb, `SCENE_BODIES`.

### Contexts

- `context/contexts.tsx` — all `createContext` calls + types (Scale, Time, Ephemeris, CameraNavigation, Selection, ArtemisMode)
- `context/providers.tsx` — Scale, CameraNavigation, Time, Selection, Layers providers
- `context/artemisMode.tsx` — `ArtemisModeProvider`

Context files export no components, component files export only components (react-refresh rule): put hooks in `hooks/`, helpers in `helper/`.

### Component Tree

```
main.tsx → ScaleProvider → CameraNavigationProvider → TimeProvider → SelectionProvider → App
  App → ArtemisModeProvider → AppInner:
    SceneErrorScreen                       # instead of everything if no WebGL / scene crashed
    EphemerisContext.Provider
    LoadingScreen                          # waits for 512px texture previews only
    SceneErrorBoundary → Canvas (logarithmicDepthBuffer, far: 500B)
      SimClock                             # freezes the frame's time
      Sun, Body[] (planets, dwarfs, moons), Orbits, AsteroidBelt
      MilkyWay, OrionSpacecraft (mission mode)
      Bloom, OrbitControls (makeDefault), CameraRig
      LabelProjector                       # projects bodies → drives SceneOverlay DOM
    SceneOverlay                           # labels, dots, selection ring, scale bar (DOM)
    OnboardingHint
    ArtemisAwareUI: NormalHUD, CelestialCard, MobileSheet, TimeBar, ArtemisButton, ArtemisHUD
```

### 3D Rendering (`lib/bodies/`)

- **Body.tsx**: any sphere body, positioned each frame. Spins from IAU data (Earth: ERA) or is tidally locked (moons without spin data). Earth layers and Saturn rings are sub-components. Textures via `useProgressiveTexture` (512px preview from `/textures/low/`, then 2k).
- **Sun.tsx**: emissive, pulsing, the scene's only light.
- **Orbits.tsx**: Sun-orbit ellipses tinted with the body's color (dwarf planets dashed), moon orbits (fade in when the planet is big on screen), and the selected spacecraft's trail only. Every orbit fades out when seen edge-on (Sun orbits judged against the ecliptic) or when the camera is right on the line, so close-ups stay clean. Selected body's orbit highlighted.
- **AsteroidBelt.tsx**: 5,000 points moving at Keplerian rates, computed in the vertex shader. In the data it's a `region` body (label on the ring's near edge via `regionAnchor`, card, "Go to" frames the ring from above).
- Spacecraft have no mesh: they're dots + labels in the overlay.
- **MilkyWay.tsx / generateGalaxy.ts**: 150k points (bulge, bar, 4 arms, disk, halo). Galaxy offset so the Sun sits at the origin; scale `S = 250,000,000`.

### Camera (`lib/camera/CameraRig.tsx`)

OrbitControls (no roll). Flights ease toward a target re-evaluated each frame (bodies move); after arrival the camera **tracks** the body (time passing, scale changing keeps the same apparent size). View snaps clear tracking. When the desktop panel is open the view is offset (`setViewOffset`) so the target sits in the free area. Mission mode: flies to/tracks Orion, Earth, Moon.

### Overlay (`lib/overlay/`)

`LabelProjector` (inside the Canvas) writes styles directly to DOM nodes registered in `overlayStore` — no React renders per frame. Rules: labels hidden behind nearer spheres, decluttered by priority (hovered > selected > Sun > planets > dwarfs > belt > spacecraft > moons), moon labels/dots only when their planet is big on screen (≥12–14 px); dots for bodies smaller than ~2.5 px; selection ring; scale bar in realistic mode. Honors the Show filters (a selected body always shows). `hoverStore` tracks the body under the pointer (3D, label or dot).

### UI (`lib/cards/`, `lib/hud/`)

- **CelestialCard** (desktop) / **MobileSheet** (mobile, drag handle to close): show `selected ?? Sun`. **CelestialDetail**: headline + stats from `helper/bodyFacts.ts`, `LiveFacts` (distances, light time, Moon phase at the simulated time), children grouped by category.
- **NormalHUD**: presets, Real scale, "Show" filters (Orbits, Spacecraft, Asteroid belt, Labels — `LayersContext`, persisted in localStorage), Info & controls modal (mobile: one "View" menu). Mission mode hides orbits without touching the saved filters.
- **TimeBar**: slower/play/faster/reverse, date picker, Now/LIVE.
- Shortcuts: `hooks/useKeyboardShortcuts.ts`, list in `helper/shortcuts.ts`.

### Data Model (`data.tsx`)

`MILKY_WAY` → `SOLAR_SYSTEM` (Sun) → planets, dwarf planets (type `planet`, category `Dwarf planet`), the asteroid belt (type `region`), spacecraft → moons (+ JWST under Earth). Fields: `type` (structural), `category` (display), `map` (slug), `texture`, `color` (marker), `image` (card; empty → texture preview), `orbitId` / `barycenter` (orbit source), `galaxy` / `mission` facts.

### Mission Mode

`config/missions.ts` (name, dates, crew, phases, spacecraft name, models). Active only between start and end date — Artemis II ended 2026-04-11, so dormant. To test locally, temporarily move `endDate`. `public/data/artemis-trajectory.json` is unused (possible replay mode).

### Static Assets

- `/public/*.jpg` — 2k textures; `/public/textures/low/` — 512px previews (regenerate when a texture changes)
- `/public/images/*.webp` — card images; `milky-way.webp` is a crop of the galaxy view
- `/public/icon.png`, `apple-touch-icon.png`, `og-image.jpg`; `docs/preview.jpg` for the README
- Real surface maps for every body (credits in the Info modal); unimaged regions (Uranus's moons, Pluto, Charon) are filled with a neutral tone

## Deploy

`deploy.sh` (git-ignored) builds locally, uploads `dist` + `scripts/` to the mini PC and keeps the cron-refreshed `orbits.json` / `artemis-live.json`. Cloudflare caches static files 4 h: same-name assets stay stale until purged.

## Conventions

- Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`)
- Tailwind utility classes inline, custom CSS in `index.css` only for scrollbars, keyframes, vertical text, reduced motion
- Font: Google Fonts "Prompt" (300/400/600/700) via `<link>` in `index.html`; HUDs use `font-mono`
- Minimum text 10–11px, secondary text ≥ 55% white; touch targets ≥ 36px on mobile
- UI z-index: `999999999` overlays, `9999999999` modals/loading (browsers clamp above 2147483647, larger values tie → DOM order)
- Clickable things are `<button>`s with an `aria-label` when icon-only
- Respect `prefers-reduced-motion` (CSS + shorter camera flights)
- Responsive: desktop sidebar + mobile bottom sheet, breakpoint at `sm:`
