# Universe Map

Interactive 3D visualization of the Solar System and Milky Way galaxy.

## Stack

- **React 19 + TypeScript + Vite** (SWC plugin, port 5317)
- **Three.js** via React Three Fiber (`@react-three/fiber`) + Drei
- **Tailwind CSS v4** (Vite plugin, no PostCSS config)
- Client-side only, no backend

## Commands

```bash
npm run dev      # Vite dev server on :5317 (--host 0.0.0.0)
npm run build    # tsc -b && vite build
npm run lint     # ESLint
```

## Architecture

### Coordinate System

Ecliptic J2000, **Z-up**. Camera up = `[0, 0, 1]`. Positions from NASA JPL Horizons in km. `KM_PER_UNIT = 6371` (1 Three.js unit = 1 Earth radius).

### Scale System

Two modes blended via `ScaleContext.blend` (0 = log, 1 = realistic):
- **Log mode**: distances compressed with `d^0.3` (planets) / `d^0.2` (moons). Small body radii boosted 3x.
- **Realistic mode**: true km-to-unit conversion.
- `ScaleProvider` animates blend with `requestAnimationFrame` lerp.

All position/radius calculations go through `helper/units.tsx`: `blendPosition()`, `blendMoonPosition()`, `blendRadius()`.

### Data Model

`data.tsx` defines a tree: `MILKY_WAY` → `SOLAR_SYSTEM` (Sun) → planets → moons.

```
CelestialBody { id, type, name, map, image, radius, distanceFromParent,
  horizonsId, info { poleRA, poleDec, spinW0, spinRate, ... }, children[] }
```

- `CELESTIAL_BODIES` = `[SOLAR_SYSTEM]` — used by 3D rendering
- `MILKY_WAY` — root for UI card navigation

### Ephemeris Pipeline

`/public/data/ephemeris.json` contains pre-fetched positions (single point) and trajectories (orbit arrays) keyed by Horizons ID. Loaded by `useEphemeris` hook → `EphemerisContext`.

### Component Tree

```
main.tsx → ScaleProvider → CameraNavigationProvider → App
  App:
    EphemerisContext.Provider
    Canvas (logarithmicDepthBuffer, far: 500B)
      Star (Sun) → Planet[] → Moon[]     # 3D bodies
      MilkyWay                            # 150k point cloud, custom shaders
      Bloom post-processing
      TrackballControls
      CameraFly                           # animated camera transitions
    SettingsPanel                          # top-left gear menu
    CelestialCard                         # desktop right sidebar
    MobileSheet                           # mobile bottom sheet
```

### 3D Rendering

- **Star.tsx**: Sun mesh with emissive pulsing, glow shell, spawns child Planets, renders orbit trajectory Lines.
- **Planet.tsx**: Generic planet renderer. Earth gets day/night/cloud layers. Orientation via IAU pole RA/Dec → ecliptic quaternion (`poleToQuaternion()`). Real-time spin via `getSpinAngle()` / `getEarthSpinAngle()` (ERA formula).
- **Moon.tsx**: Tidally locked (lookAt parent planet). Only Earth's Moon + Phobos/Deimos exist.
- **MilkyWay.tsx**: Procedural galaxy (bulge 4%, arms 40%, inter-arm 25%, halo 20%). Galaxy offset so Sun's galactic position maps to world origin. Scale factor `S = 250,000,000`.
- **CameraFly.tsx**: Handles `flyTo` (body) and `viewSnap` (top/front/home/milkyway). Cosine interpolation on position, target, up vector. Lands on sunlit hemisphere.

### UI Components

- **CelestialCard** (desktop): Right sidebar, slides in/out. Breadcrumb tree navigation through MILKY_WAY hierarchy.
- **MobileSheet**: Bottom sheet for mobile, same CelestialDetail content.
- **CelestialDetail**: Shared detail view — stats grid, atmosphere tags, fun fact, "Go to" button (triggers camera fly), children list with eye icons.
- **SettingsPanel**: Realistic scale toggle, orbit toggle, camera preset buttons (Top/Front).

### Legacy Files (unused)

- `lib/stars/Sun.tsx`, `lib/planets/Earth.tsx`, `lib/planets/Mars.tsx`, `lib/planets/Mercury.tsx` — original per-planet components, superseded by generic `Planet.tsx`
- `lib/createMesh.tsx` — factory for old per-planet components
- `lib/HideFar.tsx` — empty file

### Static Assets

- `/public/*.jpg` — 2k planet/sun/moon textures
- `/public/images/*.png` — planet images for UI cards
- `/public/data/ephemeris.json` — pre-fetched NASA JPL data
- `2k_saturn_ring_alpha.png` exists but rings not yet rendered

## Conventions

- Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`)
- Tailwind utility classes inline, custom CSS in `index.css` only for scrollbars, clip-paths, range inputs
- Font: Google Fonts "Prompt"
- UI z-index: `999999999` for overlays, `9999999999` for modals/loading
- Responsive: desktop sidebar + mobile bottom sheet, breakpoint at `sm:`
