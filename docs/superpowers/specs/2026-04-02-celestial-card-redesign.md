# Celestial Card Redesign

## Problem

The current side card has a basic design with limited planet info, no mobile support, and no hierarchical navigation. Users need detailed info about each celestial body and a way to navigate the Sun → Planet → Moon hierarchy.

## Solution

Redesign the card from scratch with a unified `CelestialBody` data model and a recursive card component that shows the same layout for any body: image, detailed stats, fun facts, and a list of children. Includes mobile bottom sheet.

## Data Model

Replace `StarParam`, `PlanetParam`, `MoonParam` with a single unified type:

```typescript
interface CelestialBody {
  id: number;
  type: "star" | "planet" | "moon";
  name: string;
  map: string;
  image: string;
  radius: number;
  distanceFromParent: number;
  info: {
    mass: string;
    gravity: number;
    temperature: number;
    dayLength: string;
    yearLength: string;
    orbitalSpeed: number;
    axialTilt: number;
    eccentricity: number;
    magneticField: boolean;
    rings: boolean;
    atmosphere: string[];
    funFact: string;
  };
  children: CelestialBody[];
}
```

`distanceFromParent` unifies `distanceFromStar` and `distanceFromPlanet`. For the Sun it is 0.

`CELESTIAL_BODIES` becomes a single `CelestialBody` (the Sun) with planets as children, and moons as children of planets.

All data must come from reliable NASA/ESA sources. Every planet includes: mass, gravity, surface temperature, day length, year length, orbital speed, axial tilt, eccentricity, magnetic field, rings, atmospheric composition, and a fun fact.

## Images

Already downloaded in `public/images/`:
- sun.png, mercury.png, venus.png, earth.png, mars.png, jupiter.png, saturn.png, uranus.png, neptune.png
- All transparent PNG, max 800px, from NASA/Wikimedia Commons

Moon images to be added when moon data is expanded.

## Card Component — CelestialCard

### State
- `path: number[]` — array of child indices for navigating the hierarchy
  - `[]` = Sun (root)
  - `[2]` = Earth (3rd child of Sun)
  - `[2, 0]` = Moon (1st child of Earth)
- `open: boolean` — whether the card is visible

### Navigation
- Click a child name → push index to path → slide-left transition
- Click breadcrumb segment → slice path to that level → slide-right transition
- Back arrow → pop last index from path → slide-right transition

### Layout (CelestialDetail)

Always the same for any CelestialBody:

1. **Breadcrumb** — `Sun > Earth > Moon`, each segment clickable
2. **Hero section** — image PNG on left, name + type label + key stats (radius, mass, temp) on right
3. **Stats grid** — 3 columns: day length, year length, moons count, gravity, axial tilt, rings
4. **Atmosphere** — pill tags (e.g., "N₂ 78%", "O₂ 21%") if atmosphere is non-empty
5. **Fun fact** — box with colored left border
6. **"Go to [name]" button** — calls `setFlyTo(body)` from CameraNavigationContext
7. **Children list** — rows with name (clickable → detail) + eye icon (fly-to direct)

### Transitions
- Child selected: current detail slides left, child detail enters from right
- Back/breadcrumb: current slides right, parent enters from left
- CSS `transform: translateX()` + `transition: transform 0.3s ease`

### Desktop
- Fixed panel on the right side of the screen
- Toggle open/close with arrow button (same as current)
- Dark semi-transparent background with backdrop blur (`bg-blur-custom`)
- Scrollable content when it overflows

### Mobile — MobileSheet
- Bottom sheet, slides up from bottom
- Height: ~70vh
- Scrollable content inside
- Close: swipe down or tap dark overlay behind
- Open: floating button at bottom of screen (menu/list icon)
- Same CelestialDetail content inside

## CameraFly Updates

- `flyTo` type changes from `PlanetParam` to `CelestialBody`
- For stars: fly to position [0, 0, 0] with offset based on star radius
- For planets: same as current (compute position from `distanceFromParent`)
- For moons: compute position from parent planet position + moon's `distanceFromParent`

## Files

### New
- `src/lib/cards/CelestialCard.tsx` — Main card component with path navigation, transitions, desktop/mobile detection
- `src/lib/cards/CelestialDetail.tsx` — Detail layout (hero, stats, atmosphere, fun fact, children list)
- `src/lib/cards/MobileSheet.tsx` — Bottom sheet wrapper for mobile

### Modified
- `src/data.tsx` — New `CelestialBody` type, enriched data with all info fields, remove old types
- `src/lib/stars/Star.tsx` — Use `CelestialBody` instead of `StarParam`
- `src/lib/planets/Planet.tsx` — Use `CelestialBody` instead of `PlanetParam`
- `src/lib/moons/Moon.tsx` — Use `CelestialBody` instead of `MoonParam`
- `src/lib/camera/CameraFly.tsx` — Use `CelestialBody` instead of `PlanetParam`, handle star/moon fly-to
- `src/context/cameraNavigation.tsx` — `flyTo: CelestialBody | null`
- `src/App.tsx` — Use new CelestialCard, pass CELESTIAL_BODIES, remove old Card import

### Deleted
- `src/lib/cards/Card.tsx` — Replaced by CelestialCard

## Dependencies
None new. Uses existing: React, Tailwind CSS, react-icons (FaEye, MdArrowForwardIos).
