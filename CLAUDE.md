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
npm test          # Vitest: orbital model vs JPL Horizons fixtures, scale rules, flight paths, galaxy model, star photometry, dark clouds
npm run test:e2e  # Playwright smoke tests against `vite preview` (build first); uses local Chrome, CI installs Chromium
```

## Architecture

### Coordinate System

Ecliptic J2000, **Z-up**. Positions in km from NASA JPL Horizons. `KM_PER_UNIT = 6371` (1 Three.js unit = 1 Earth radius).

Camera up = ecliptic north `[0, 0, 1]` among the planets, turning to the galactic north pole far out (`cameraUp(distance from the Sun)` in `helper/galaxy.ts`, set every frame by CameraRig). OrbitControls re-reads `camera.up` on each update, so orbiting follows: around the ecliptic pole in the Solar System, around the galaxy's pole in the galaxy view.

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
    LoadingScreen                          # until the scene is really ready (see Loading)
    SceneErrorBoundary → Canvas (logarithmicDepthBuffer, far: 5T)
      SimClock                             # freezes the frame's time
      Sun, Body[] (planets, dwarfs, moons), Orbits, AsteroidBelt
      MilkyWay, OrionSpacecraft (mission mode)
      Bloom, OrbitControls (makeDefault), CameraRig
      LabelProjector                       # projects bodies → drives SceneOverlay DOM
      GalaxyLabelProjector                 # galaxy names + "you are here" marker
      SceneReady                           # marks textures loaded, compiles the scene (Loading)
    SceneOverlay                           # labels, dots, selection ring, scale bar, galaxy names (DOM)
    OnboardingHint
    ArtemisAwareUI: NormalHUD, CelestialCard, MobileSheet, TimeBar, ArtemisButton, ArtemisHUD
```

### 3D Rendering (`lib/bodies/`)

- **Body.tsx**: any sphere body, positioned each frame. Spins from IAU data (Earth: ERA) or is tidally locked (moons without spin data). Earth layers and Saturn rings are sub-components. Textures via `useProgressiveTexture` (512px preview from `/textures/low/`, then 2k).
- **Sun.tsx**: emissive, pulsing, the scene's only light, and the only thing bright enough to bloom (`Bloom` threshold 1: nothing at or below white glows).
- **Orbits.tsx**: Sun-orbit ellipses tinted with the body's color (dwarf planets dashed), moon orbits (fade in when the planet is big on screen), and the selected spacecraft's trail only. Every orbit fades out when seen edge-on (Sun orbits judged against the ecliptic) or when the camera is right on the line, so close-ups stay clean. Selected body's orbit highlighted.
- **AsteroidBelt.tsx**: 9,000 points (seeded) moving at Keplerian rates, computed in the vertex shader. Additive and light-conserving: each point stands for a patch of the belt (sized relative to its distance from the Sun); under 2 px it dims instead of shrinking, so from afar the belt is a soft glow, not a crowd of dots. Most points faint (few big asteroids, many small). Fades to 15% when the camera is closer to the Sun than the belt, so it doesn't clutter the inner planets' sky. In the data it's a `region` body (label on the ring's near edge via `regionAnchor`, card, "Go to" frames the ring from above).
- Spacecraft have no mesh: they're dots + labels in the overlay.
- **The Solar System** (planets, orbits, belt) is hidden once Neptune's orbit is under a pixel (`SOLAR_SYSTEM_HIDE_FACTOR` × its scene distance, so later in real scale).

### The Milky Way (`helper/galaxy.ts`, `lib/galaxy/`)

- **Model** (`helper/galaxy.ts`, units of 100 ly, Galactic Center at the origin, Sun at `(0, −8.2 kpc)`): long bar 28° from the Sun–center line; the major arms (Scutum–Centaurus, Perseus) leave from its ends, the minor arms (Sagittarius–Carina, Norma–Outer) lie between, the 3-kpc arms hug the bar, the Sun is in the Orion Spur. Log spirals (`armPoint`, `armOffset`) fitted to maser parallaxes (Reid et al.). Covered by `src/__tests__/galaxy.test.ts`.
- **Placement**: `GALAXY_MATRIX` rotates the model into ecliptic J2000 (galactic → equatorial → ecliptic): the Galactic Center lies toward Sagittarius, the disk is tilted ~60° to the planets' plane, so from the Solar System the Milky Way crosses the sky as it really does. Scale `GALAXY_SCALE = 250,000,000` scene units per model unit: a backdrop, ~600× smaller than real relative to the Solar System in real scale.
- **Made of stars and dust only** (`MilkyWay.tsx`, `galaxyShaders.ts`), the same rules from every viewpoint (face-on, edge-on, from Earth). Two star sets:
  - `generateSky`: 120,000 single stars in 3D around the Sun, down to mag 9.5 seen from the Sun (B/A/F/G stars, K/M giants; about the real counts per magnitude, `src/__tests__/sky.test.ts`). Seeded: same sky on every visit.
  - 2 million groups of stars generated on the GPU from their index (empty geometry + draw range, `gl_VertexID` → PCG hash; 600k on touch screens, 150k on software WebGL via `isSoftwareRenderer`): globulars, boxy bulge (exponential vertical profile, 0.45 kpc: from Earth it rises above the dust as the Sagittarius star clouds), bar, thin and thick disk, old stars along the arms, young blue clusters (16 consecutive indices each), halo. Absolute magnitude −7.8 with 2 million; with fewer each is brighter, so the galaxy's light stays the same. They thin out within 0.8–2.2 kpc of the Sun, where the single stars take over, but only while the camera is near the Sun (within 0.5–3 kpc): from farther those stars are too faint to stand for the local disk, which would show as a dark hole.
- **Photometry**: one rule for every star: magnitude from absolute magnitude, distance and dust (`+1.0857 τ`), light relative to a magnitude-1 star. Then two looks, by distance from the camera:
  - **Points** (single stars, and groups nearer than 12 kpc): brightness compressed like a photo (`flux^0.42`, capped at white), size 1.4–4.6 px growing with it, fading over the last 1.5 mag before mag 12. Groups as points are dimmed (`GROUP_POINT_FLUX`) and, within ~5 kpc of the center, thinned to a third (`CORE_POINTS`): drawn whole, the core seen from Earth is one compact sheet of yellow (a look over realism, asked for). They get more on devices with fewer groups (`uPointFlux`: compressed light doesn't add up linearly). Old stars are mostly pale yellow-white, a few orange; dust reddens at most as much as τ = 0.8 would.
  - **Glow** (groups beyond 24 kpc, gradually from 12): their stars can't be told apart, so their light is summed linearly in a half-float buffer of its own (portal scene, 2-px bilinear splats, rendered at frame priority 0.5: after the camera moves, before the composer), blurred (Gaussian, 1 CSS px) and stretched like an astronomical photo (asinh) onto a full-screen quad under everything else (renderOrder −1000, additive). In light per CSS pixel: the same on every screen and at every distance (surface brightness is conserved).
- **Dust**: a 3D field. Surface density baked once into a 1024² map, stored as √(density/4) for 8-bit precision where it's thin (`dustBakeFragmentShader`: a clumpy diffuse layer with a 4 kpc scale length, swept out of the inner 3 kpc; narrow dense lanes on the arms' inner edges; a light Central Molecular Zone; `compileAsync`, a strip per frame) × a vertical profile (scale height 0.1 kpc), empty inside the Local Bubble (0.1–0.25 kpc around the Sun). Every star and nebula integrates the dust between it and the camera (10 samples, denser near the camera): dimmed and reddened. Calibrated (`DUST_OPACITY`) on measured extinction: A_V ≈ 1 mag/kpc in the plane near the Sun, ≈ 2 toward Baade's Window, ≈ 1 at b = −6°, ≈ 0.6 at b = −10°, < 0.2 toward the poles (an earlier, 4–8× denser version hid the bulge: the galaxy's center looked dark from Earth and edge-on). The lanes seen from above, the thin dark midplane edge-on and the rift through the band from Earth all come from it.
- **Dark clouds** (`helper/darkClouds.ts`): the real ones within ~1 kpc at their real places (Taurus, Orion, Ophiuchus, the Pipe Nebula, the Aquila and Cygnus Rifts, the Coalsack…), each a few Gaussian blobs strung across it, plus anonymous clumps near the plane: 120 blobs as uniforms (`uClouds`, `uCloudDepth` four per vector). Integrated exactly along each line of sight (erf), made lumpy and stringy by 3D noise, skipped by lines of sight that pass far from the Sun. They make the Great Rift ragged and dim the stars behind them, not those in front; their depth has a soft limit (`CLOUD_MAX_TAU`, A_V ≈ 2.4): never black patches (`src/__tests__/darkClouds.test.ts`). Costly near the Sun (every star sums the blobs): points already too faint to show skip them, software WebGL skips them altogether (`uCloudScale` 0, also the "Dark clouds" setting).
- **Nebulae**: 6,000 star-forming regions along the arms, soft pale-pink sprites of constant surface brightness (flux-conserving below 1.5 px), in the glow buffer. Faint: a few as bright as the Lagoon or Orion nebulae, most far dimmer (`lit` ∝ rnd³).
- Design rule: no image planes, no glow baked into the sky, no star popping in or out with zoom; every change in brightness comes from distance and dust. Tried and dropped: a sky glow baked from the model (read as haze), a textured disk plane (vanished edge-on), one asinh stretch for every star (stars turned into blobs).

### Camera (`lib/camera/CameraRig.tsx`)

OrbitControls (no roll). **Flights** follow van Wijk & Nuij's zoom path (`helper/flight.ts`, as in d3-zoom): zoom out, travel, zoom in, at a steady perceived speed; distance changes exponentially, so galaxy ↔ planet (10 orders of magnitude) takes the same time per tenfold step. Duration from the path length (1–5 s, 0.6 s with reduced motion), sine-shaped speed ramps. The camera's direction turns around the moving center (around the ecliptic pole) and rises up to 22° above the planets' plane on flights that zoom out across the system. Start and end targets are re-evaluated every frame (bodies move; leaving a tracked body keeps following it). Arrival: sunward of the body, turned 35° aside and 15° up so the terminator shows; ringed planets from 25° above the rings' sunlit face; landing at 4 radii (6 with rings). A new request takes over a flight in progress; grabbing the view (pointer down / wheel, capture phase) stops it. Every flight starts by dropping the glide the controls still carry from the user's last drag (`settleControls`): drei only updates them while enabled, so a pan made in the galaxy view would otherwise play out after landing in the Solar System and carry the camera kiloparsecs away. After arrival the camera **tracks** the body (time passing, scale changing keeps the same apparent size). View snaps clear tracking: `home` / `top` / `front` frame the Solar System (top and side fit Neptune's whole orbit, side 12° above the plane so the orbits don't fade edge-on: `systemViewOffset` in `helper/views.ts`), `milkyway` / `milkyway-top` / `milkyway-side` the whole galaxy (`galaxyViewOffset(aspect, fov, "overview" | "top" | "side")`: tilted 35° with the Sun's side nearest, face-on with the Sun below the center, edge-on from a quarter turn away). When the desktop panel is open the view is offset (`setViewOffset`) so the target sits in the free area, and views are framed for the free area's aspect. Mission mode: flies to/tracks Orion, Earth, Moon.

### Overlay (`lib/overlay/`)

`LabelProjector` (inside the Canvas) writes styles directly to DOM nodes registered in `overlayStore` — no React renders per frame. Wheel events on names and markers are passed on to the canvas, so zooming works with the pointer on them. Rules: labels hidden behind nearer spheres, decluttered by priority (hovered > selected > Sun > planets > dwarfs > belt > spacecraft > moons), moon labels/dots only when their planet is big on screen (≥12–14 px); dots for bodies smaller than ~2.5 px; selection ring; scale bar in realistic mode. Honors the Show filters (a selected body always shows). `hoverStore` tracks the body under the pointer (3D, label or dot).

`GalaxyLabelProjector` does the same for the galaxy view: the Solar System's "you are here" marker (shown while the planets are hidden, click → Overview), the Galactic Center and the arms' names (`GALAXY_LANDMARKS`; beyond ~6,000 ly from the Sun, arms only when the disk is seen from above). Decluttered by priority, kept clear of the screen edges and the Explore tab.

### UI (`lib/cards/`, `lib/hud/`)

- **CelestialCard** (desktop) / **MobileSheet** (mobile, drag handle to close): show `selected ?? Sun`. **CelestialDetail**: headline + stats from `helper/bodyFacts.ts`, `LiveFacts` (distances, light time, Moon phase at the simulated time), children grouped by category.
- **NormalHUD** (`<nav aria-label="Map controls">`): one panel. A Solar System | Milky Way switch shows the level the camera is at (`level` from `SolarSystemVisibility`) and flies to the other; View: Overview, Top, Side for that level, the one asked for lit until the camera moves some other way (`activeView` in CameraNavigationContext, cleared by a flight to a body or the user grabbing the view); Real scale (Solar System only); Settings, a disclosure grouped by level — Solar System: orbits, moons, spacecraft, asteroid belt, names; Milky Way: stars, dark clouds, nebulae, names; Display: star brightness (0.4–1.6, `LayersContext.brightness`) — all persisted in localStorage, a selected body always shows; About & shortcuts modal behind the (i). Mobile: the same panel behind a menu button. Mission mode hides orbits without touching the saved filters.
- **TimeBar**: slower/play/faster/reverse, date picker, Now/LIVE.
- Shortcuts: `hooks/useKeyboardShortcuts.ts`, list in `helper/shortcuts.ts` (G switches level; O / T / S frame the current one).

### Loading (`helper/loadingStore.ts`)

Four steps, marked as they finish: `data` (orbits.json, AppInner), `textures` (`SceneReady`'s first effect: R3F commits the Canvas tree only once every suspended texture preview has loaded), `galaxy` (MilkyWay: dust map baked, glow and blur shaders compiled with `compileAsync`), `scene` (`SceneReady`: `compileAsync` on the whole scene, then two frames). `LoadingScreen` (`hooks/useLoadingSteps.ts`) shows the step under way and the progress (texture share from drei's `useProgress`), fades out on `scene`, gives up after 30 s; the onboarding hint waits for it too. The smoke tests wait for its progress bar to go.

### Data Model (`data.tsx`)

`MILKY_WAY` → `SOLAR_SYSTEM` (Sun) → planets, dwarf planets (type `planet`, category `Dwarf planet`), the asteroid belt (type `region`), spacecraft → moons (+ JWST under Earth). Fields: `type` (structural), `category` (display), `map` (slug), `texture`, `color` (marker), `image` (card; empty → texture preview), `orbitId` / `barycenter` (orbit source), `galaxy` / `mission` facts.

### Mission Mode

`config/missions.ts` (name, dates, crew, phases, spacecraft name, models). Active only between start and end date — Artemis II ended 2026-04-11, so dormant. To test locally, temporarily move `endDate`. `public/data/artemis-trajectory.json` is unused (possible replay mode).

### Static Assets

- `/public/*.jpg` — 2k textures; `/public/textures/low/` — 512px previews (regenerate when a texture changes)
- `/public/images/*.webp` — card images; `milky-way.webp` is a 256px crop of the face-on galaxy view (regenerate if the model or its rendering changes)
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
