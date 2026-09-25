# Universe Map

Interactive 3D visualization of the Solar System and Milky Way galaxy.

## Stack

- **React 19 + TypeScript + Vite** (SWC plugin, port 5317)
- **Three.js** via React Three Fiber (`@react-three/fiber`) + Drei
- **Tailwind CSS v4** (Vite plugin, no PostCSS config)
- Client-side only, no backend (static files + cron-refreshed JSON on the server)

## Commands

```bash
npm run dev      # Vite dev server on :5317 (--host 0.0.0.0)
npm run build    # tsc -b && vite build (three.js and other libraries in separate cached chunks)
npm run lint     # ESLint — keep it at 0 errors, 0 warnings
```

## Architecture

### Coordinate System

Ecliptic J2000, **Z-up**. Camera up = `[0, 0, 1]`. Positions from NASA JPL Horizons in km. `KM_PER_UNIT = 6371` (1 Three.js unit = 1 Earth radius).

### Scale System

Two modes blended via `blend` (0 = log, 1 = realistic):
- **Log mode**: distances compressed with `d^0.3` (planets). Radii boosted 3x but capped at 5 units, so the function stays monotonic (Uranus/Neptune never outgrow Jupiter/Saturn). Min radius 0.5.
- **Moons in log mode**: `d^0.2` measured from the planet's surface (or Saturn's ring edge), not its center, so moons never end up inside their planet.
- **Realistic mode**: true km-to-unit conversion.

`blend` lives in a **ref** (`ScaleContext.blendRef`), animated by `ScaleProvider` with a `requestAnimationFrame` lerp. 3D components read it in `useFrame` and set position/scale imperatively — changing the scale never re-renders the React tree. Don't turn it back into state.

Math lives in `helper/units.tsx` (`blendPosition`, `blendMoonPosition`, `blendRadius`, `poleToEcliptic`, `poleToQuaternion`, spin angles). Body placement shared by rendering and camera lives in `helper/bodyPosition.ts` (`planetPosition`, `moonOffset`, Saturn ring constants) — `Planet`, `Moon` and `CameraFly` must all go through it.

### Data Model

`data.tsx` defines a tree: `MILKY_WAY` → `SOLAR_SYSTEM` (Sun) → 8 planets → 18 moons.

```
CelestialBody { id, type, name, map, image, radius, distanceFromParent,
  horizonsId, info { poleRA, poleDec, spinW0, spinRate, ... }, children[] }
```

- `CELESTIAL_BODIES` = `[SOLAR_SYSTEM]` — used by 3D rendering
- `MILKY_WAY` — root for UI card navigation (tree helpers in `lib/cards/bodyTree.ts`)

### Ephemeris Pipeline

`/public/data/ephemeris.json` contains positions (single point) and trajectories (orbit arrays) keyed by Horizons ID. Loaded by `useEphemeris` (memoized result) → `EphemerisContext`.

- `scripts/fetch-ephemeris.mjs` refreshes it (cron on the server, daily). Writes to `dist/data` if it exists, else `public/data`. Atomic write (tmp + rename); bodies that fail keep the previous day's data.
- `deploy.sh` (git-ignored) keeps the server's cron-refreshed JSON across deploys.

### Contexts

- `context/contexts.tsx` — all `createContext` calls + types: `ScaleContext`, `CameraNavigationContext`, `ArtemisModeContext`
- `context/providers.tsx` — `ScaleProvider`, `CameraNavigationProvider`
- `context/artemisMode.tsx` — `ArtemisModeProvider`
- `context/ephemeris.tsx`, `context/bodySelection.tsx` — context only

Context files export no components and provider files export only components (react-refresh lint rule). Provider values are memoized.

### Component Tree

```
main.tsx → ScaleProvider → CameraNavigationProvider → App
  App → ArtemisModeProvider → AppInner:
    SceneErrorScreen                      # instead of everything if no WebGL / scene crashed
    EphemerisContext.Provider
    LoadingScreen
    SceneErrorBoundary → Canvas (logarithmicDepthBuffer, far: 500B)
      Star (Sun) → Planet[] → Moon[]      # 3D bodies, positioned in useFrame
      MilkyWay                            # 150k point cloud, custom shaders
      OrionSpacecraft                     # Artemis mode only
      Bloom post-processing
      TrackballControls
      CameraFly                           # animated camera transitions
    ArtemisAwareUI
      NormalHUD                           # top-left: title, view presets, scale/orbit toggles, info
      CelestialCard                       # desktop right sidebar
      MobileSheet                         # mobile bottom sheet
      ArtemisButton / ArtemisHUD          # only while a mission is active
```

### 3D Rendering

- **Star.tsx**: Sun mesh with emissive pulsing, glow shell, spawns child Planets, renders orbit Lines (buffers rewritten in `useFrame` only when `blend` changes).
- **Planet.tsx**: Generic planet renderer. Earth gets day/night/cloud layers, Saturn gets rings. Orientation via IAU pole RA/Dec → ecliptic quaternion. Real-time spin via `getSpinAngle()` / `getEarthSpinAngle()` (ERA formula).
- **Moon.tsx**: Tidally locked (lookAt parent planet). 18 moons; several use `2k_fictional_*` placeholder textures.
- **MilkyWay.tsx**: Procedural galaxy (bulge 4%, arms 40%, inter-arm 25%, halo 20%). Galaxy offset so Sun's galactic position maps to world origin. Scale factor `S = 250,000,000`.
- **CameraFly.tsx**: Handles `flyTo` (body), `viewSnap` (top/front/home/milkyway) and Artemis camera targets/tracking. Cosine interpolation on position, target, up vector. Lands on sunlit hemisphere.

### Mission Mode (Artemis II)

`config/missions.ts` defines the mission; `getActiveMission()` returns it only between `startDate` and `endDate`. Artemis II ended 2026-04-11, so the mode is currently dormant. The spacecraft position is pulled per frame via `getSpacecraftPosition()` (no React state at 60fps); HUD values update 1/sec. `public/data/artemis-trajectory.json` is fetched but not used yet (planned replay mode).

### UI Components

- **CelestialCard** (desktop) / **MobileSheet** (mobile): same `CelestialDetail`, `Breadcrumb`, `ExploreTab`. Mobile closes the sheet when a camera flight starts (`onFly`).
- **CelestialDetail**: stats grid, atmosphere tags, fun fact, "Go to" button, children list (name button + fly-to eye button).
- **NormalHUD**: title, data date, Top/Front/Overview presets, Real Scale + Orbits switches, Info modal.

### Static Assets

- `/public/*.jpg` — 2k planet/sun/moon textures
- `/public/images/*.webp` — 256px planet images for UI cards
- `/public/icon.png` (64px favicon), `/public/apple-touch-icon.png`, `/public/og-image.jpg` (social preview)
- `/public/models/*.glb` — Orion models
- `/public/data/*.json` — ephemeris + Artemis data
- `docs/preview.jpg` — README screenshot

## Conventions

- Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`)
- Tailwind utility classes inline, custom CSS in `index.css` only for scrollbars, animations/keyframes, vertical text
- Font: Google Fonts "Prompt" (300/400/600/700), loaded via `<link>` in `index.html`; HUDs use `font-mono`
- UI z-index: `999999999` for overlays, `9999999999` for modals/loading (values above 2147483647 are clamped by browsers, so larger ones tie and DOM order decides)
- Clickable things are `<button>`s with an `aria-label` when icon-only
- Responsive: desktop sidebar + mobile bottom sheet, breakpoint at `sm:`
