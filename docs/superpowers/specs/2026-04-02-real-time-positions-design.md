# Real-Time Solar System Positions

## Problem

The current solar system map uses static positions from hardcoded data. Planets are placed along the Z axis with a user-adjustable scale. Positions, orbits, and inclinations don't reflect reality. This needs to change to real-time positions from NASA's JPL Horizons API before adding features like Artemis 2 tracking.

## Solution

Fetch real-time 3D positions (heliocentric ecliptic J2000, in km) for all celestial bodies from the JPL Horizons API. Display orbital trajectories as semi-transparent lines. Provide a settings panel for distance scale and orbit visibility.

## API

JPL Horizons API: `https://ssd.jpl.nasa.gov/api/horizons.api`
- Free, no auth, CORS-enabled
- Returns JSON with text-formatted ephemeris data between `$$SOE`/`$$EOE` markers
- One request per body, all run in parallel
- Coordinates in km, heliocentric ecliptic J2000

See `docs/research/2026-04-02-horizons-api-research.md` for full API documentation.

## Horizons Body IDs

Each `CelestialBody` gets a new `horizonsId` field:

| Body | Horizons ID |
|------|-------------|
| Sun | `10` |
| Mercury | `199` |
| Venus | `299` |
| Earth | `399` |
| Moon | `301` |
| Mars | `499` |
| Phobos | `401` |
| Deimos | `402` |
| Jupiter | `599` |
| Saturn | `699` |
| Uranus | `799` |
| Neptune | `899` |

## Architecture

### HorizonsService (`src/services/horizons.ts`)

Pure module (no React). Handles API calls and response parsing.

```typescript
interface EphemerisPoint {
  x: number;  // km, heliocentric ecliptic J2000
  y: number;
  z: number;
}

interface EphemerisData {
  [horizonsId: string]: EphemerisPoint;
}

interface TrajectoryData {
  [horizonsId: string]: EphemerisPoint[];  // array of points over time
}

// Fetch current position of all bodies
async function fetchEphemeris(
  bodyIds: string[],
  time?: Date
): Promise<EphemerisData>

// Fetch trajectory (multiple time points) for all bodies
async function fetchTrajectories(
  bodyIds: string[],
  startTime: Date,
  endTime: Date,
  stepSize: string  // "1d" for planets, etc.
): Promise<TrajectoryData>
```

- Uses `Promise.allSettled` for parallel requests — one body failing doesn't block others
- Parses the text response with regex to extract X, Y, Z values
- Returns `null` for bodies that fail

### useEphemeris hook (`src/hooks/useEphemeris.ts`)

React hook that manages the data lifecycle.

```typescript
interface UseEphemerisResult {
  positions: EphemerisData | null;
  trajectories: TrajectoryData | null;
  loading: boolean;
  error: boolean;
}
```

Behavior:
1. Mount: `loading = true`, fetch positions + trajectories in parallel
2. Success: save data, `loading = false`
3. Failure: `error = true`, `loading = false` — components fall back to static data from `data.tsx`
4. Every 30 minutes: silent refetch of positions (not trajectories — those change slowly). On success, update positions. On failure, keep last valid positions.
5. Unmount: clear interval timer

### EphemerisContext (`src/context/ephemeris.tsx`)

Context + Provider that exposes `UseEphemerisResult` to all components.

Called once in `App.tsx` (or `main.tsx`), all 3D components and CameraFly read from it via `useContext`.

### Trajectory fetch details

For current positions: fetch a single point at `time = now`.

For trajectories:
- Planets: 365 points, 1-day intervals, covering the last year
- Moons: 30 points, 1-day intervals, covering the last month
- Sun: no trajectory (it's the origin)

Trajectories are fetched once at page load and not refreshed (orbits don't change noticeably in a session).

## Loading Screen (`src/lib/LoadingScreen.tsx`)

- Full-screen overlay, black background, white centered text
- Shows "Loading Solar System..." with subtle opacity pulse animation
- Displayed while `loading = true` from useEphemeris
- Fade-out transition when loading completes
- If `error = true` and fallback to static data is active: brief "Using offline data" notice that auto-dismisses after 3 seconds

## Settings Panel (`src/lib/settings/SettingsPanel.tsx`)

- Position: fixed, top-left
- Default state: collapsed, shows only a gear icon
- Click: expands to show controls
- Style: black transparent background (`#000000b3`) + backdrop blur (same as card)

Controls:
- **Scale distance:** range slider 1-1000 (same as current)
- **Show orbits:** toggle on/off (default: on)

Replaces the current scale distance box in `App.tsx`.

## How 3D Components Use Real Positions

### Coordinate conversion

One Three.js unit = 1 Earth radius (6,371 km). This maintains compatibility with existing planet sizes.

```
position_threejs = position_km / 6371
```

The scale distance slider divides this further:

```
position_final = position_threejs / scaleDistance
```

### Sun (Star.tsx)

Position is always `[0, 0, 0]` — it's the origin of the heliocentric frame.

### Planets (Star.tsx → Planet.tsx)

Star.tsx reads `ephemeris.positions["399"]` for Earth's position, converts km → Three.js units, divides by scaleDistance, and passes as position to Planet component.

Planet.tsx receives its absolute position as a prop (already scaled).

### Moons (Planet.tsx → Moon.tsx)

Moon positions from API are heliocentric (relative to Sun). Since moons are children of planet groups in Three.js, convert to parent-relative:

```
moon_local = (moon_api_position - planet_api_position) / 6371 / scaleDistance
```

### CameraFly

Reads positions directly from EphemerisContext instead of computing them. `computeBodyPosition` becomes a simple lookup + conversion:

```typescript
function computeBodyPosition(body: CelestialBody, positions: EphemerisData, scaleDistance: number): Vector3 {
  const pos = positions[body.horizonsId];
  return new Vector3(pos.x / 6371 / scaleDistance, pos.y / 6371 / scaleDistance, pos.z / 6371 / scaleDistance);
}
```

### Smooth transition on refresh

When new positions arrive (every 30 min), components interpolate from old to new position using lerp in `useFrame` over ~1 second. The position change is tiny (planets barely move in 30 min) so this is imperceptible.

### Orbital trajectories

Rendered as `THREE.Line` with `LineBasicMaterial`:
- Color: white
- Opacity: 0.1
- Transparent: true
- DepthWrite: false

Each trajectory is an array of points from the API, converted to Three.js coordinates with the same km → units → scale conversion. The line updates when scaleDistance changes.

Visibility controlled by the "Show orbits" toggle in SettingsPanel.

### Fallback to static data

If API fetch fails, components use `distanceFromParent` from `data.tsx` to compute positions along the Z axis (same as current behavior). The scale slider works the same way. A small "offline" indicator appears briefly.

## Data Model Changes

Add `horizonsId` field to `CelestialBody`:

```typescript
interface CelestialBody {
  // ... existing fields ...
  horizonsId: string;  // JPL Horizons body ID
}
```

## helper/units.tsx Changes

Simplify to a single conversion function:

```typescript
const KM_PER_UNIT = 6371;  // 1 unit = 1 Earth radius

function kmToUnits(km: number): number {
  return km / KM_PER_UNIT;
}
```

Keep `ScaleEarthUnitSize` for planet radius conversion (still needed for mesh sizes). Remove or simplify `ScaleDistance` — positions now come from the API, not from computation.

## Files

### New
- `src/services/horizons.ts` — API calls, parsing, interfaces
- `src/hooks/useEphemeris.ts` — Hook with loading, refresh, fallback
- `src/context/ephemeris.tsx` — EphemerisContext + Provider
- `src/lib/LoadingScreen.tsx` — Loading screen
- `src/lib/settings/SettingsPanel.tsx` — Collapsible settings panel (top-left)

### Modified
- `src/data.tsx` — Add `horizonsId` field to CelestialBody and all bodies
- `src/lib/stars/Star.tsx` — Read positions from EphemerisContext
- `src/lib/planets/Planet.tsx` — Read positions from EphemerisContext, render trajectory line
- `src/lib/camera/CameraFly.tsx` — Read positions from EphemerisContext
- `src/helper/units.tsx` — Simplify to km↔units conversion
- `src/App.tsx` — Add EphemerisProvider, LoadingScreen, SettingsPanel, remove old slider box
- `src/main.tsx` — Wrap with EphemerisProvider

## Known Limitation — Moon overlap at high compression

At high scale compression (slider > ~10x), moon distances get compressed to the point where moons overlap with their parent planets visually (e.g., at 50x, Earth's Moon is 1.2 units from Earth but Earth's radius is 1.0 unit). This is accepted for now. A future task will revisit the compression system to add limits and potentially scale radii proportionally.

## Dependencies

None new. Uses browser `fetch()` for API calls.
