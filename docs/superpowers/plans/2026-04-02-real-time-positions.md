# Real-Time Solar System Positions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static planet positions with real-time data from NASA's JPL Horizons API, add orbital trajectory lines, and provide a settings panel.

**Architecture:** A `HorizonsService` module handles API calls and parsing. A `useEphemeris` hook manages the data lifecycle (loading, refresh, fallback). An `EphemerisContext` distributes positions to all 3D components. A loading screen covers initial data fetch. A settings panel replaces the current scale slider box.

**Tech Stack:** React, Three.js, React Three Fiber, JPL Horizons API (browser fetch, CORS-enabled)

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/data.tsx` | Modify | Add `horizonsId` field to CelestialBody |
| `src/services/horizons.ts` | Create | API calls, response parsing, interfaces |
| `src/hooks/useEphemeris.ts` | Create | Data lifecycle: loading, refresh, fallback |
| `src/context/ephemeris.tsx` | Create | EphemerisContext + Provider |
| `src/helper/units.tsx` | Modify | Add `kmToUnits()`, simplify |
| `src/lib/LoadingScreen.tsx` | Create | Full-screen loader |
| `src/lib/settings/SettingsPanel.tsx` | Create | Collapsible settings panel |
| `src/lib/stars/Star.tsx` | Modify | Use ephemeris positions for planets |
| `src/lib/planets/Planet.tsx` | Modify | Use ephemeris positions for moons, add orbit line |
| `src/lib/camera/CameraFly.tsx` | Modify | Use ephemeris positions |
| `src/App.tsx` | Modify | Wire providers, loading screen, settings panel |
| `src/main.tsx` | Modify | Wrap with EphemerisProvider |

---

### Task 1: Add horizonsId to data model

**Files:**
- Modify: `src/data.tsx`

- [ ] **Step 1: Add horizonsId to CelestialBody interface**

In `src/data.tsx`, add `horizonsId: string;` to the interface after `distanceFromParent`:

```typescript
  distanceFromParent: number;
  horizonsId: string;
```

- [ ] **Step 2: Add horizonsId to every body in SOLAR_SYSTEM**

Sun:
```typescript
  distanceFromParent: 0,
  horizonsId: "10",
```

Mercury: `horizonsId: "199"`
Venus: `horizonsId: "299"`
Earth: `horizonsId: "399"`
Moon: `horizonsId: "301"`
Mars: `horizonsId: "499"`
Phobos: `horizonsId: "401"`
Deimos: `horizonsId: "402"`
Jupiter: `horizonsId: "599"`
Saturn: `horizonsId: "699"`
Uranus: `horizonsId: "799"`
Neptune: `horizonsId: "899"`

Add `horizonsId` right after `distanceFromParent` for each body.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/matteo/Desktop/projects/js_websites/universe_map && npx tsc -p tsconfig.app.json --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/data.tsx
git commit -m "feat: add horizonsId field to CelestialBody for JPL Horizons API"
```

---

### Task 2: Create HorizonsService

**Files:**
- Create: `src/services/horizons.ts`

- [ ] **Step 1: Create the service module**

```typescript
const HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const KM_PER_UNIT = 6371;

export interface EphemerisPoint {
  x: number;
  y: number;
  z: number;
}

export interface EphemerisData {
  [horizonsId: string]: EphemerisPoint;
}

export interface TrajectoryData {
  [horizonsId: string]: EphemerisPoint[];
}

function buildUrl(
  bodyId: string,
  startTime: string,
  stopTime: string,
  stepSize: string
): string {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${bodyId}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    START_TIME: `'${startTime}'`,
    STOP_TIME: `'${stopTime}'`,
    STEP_SIZE: `'${stepSize}'`,
    VEC_TABLE: "'2'",
    REF_PLANE: "'ECLIPTIC'",
    OUT_UNITS: "'KM-S'",
  });
  return `${HORIZONS_API}?${params.toString()}`;
}

function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function parseEphemerisPoints(result: string): EphemerisPoint[] {
  const soeIndex = result.indexOf("$$SOE");
  const eoeIndex = result.indexOf("$$EOE");
  if (soeIndex === -1 || eoeIndex === -1) return [];

  const dataBlock = result.slice(soeIndex + 5, eoeIndex);
  const regex =
    /X\s*=\s*([-\d.E+]+)\s*Y\s*=\s*([-\d.E+]+)\s*Z\s*=\s*([-\d.E+]+)/g;

  const points: EphemerisPoint[] = [];
  let match;
  while ((match = regex.exec(dataBlock)) !== null) {
    points.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      z: parseFloat(match[3]),
    });
  }
  return points;
}

async function fetchSingleBody(
  bodyId: string,
  startTime: string,
  stopTime: string,
  stepSize: string
): Promise<EphemerisPoint[] | null> {
  try {
    const url = buildUrl(bodyId, startTime, stopTime, stepSize);
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.error) return null;
    return parseEphemerisPoints(data.result);
  } catch {
    return null;
  }
}

export async function fetchEphemeris(
  bodyIds: string[],
  time?: Date
): Promise<EphemerisData> {
  const now = time || new Date();
  const startTime = formatDate(now);
  // Request a 1-minute window to get a single point
  const end = new Date(now.getTime() + 60000);
  const stopTime = formatDate(end);

  const results = await Promise.allSettled(
    bodyIds.map((id) => fetchSingleBody(id, startTime, stopTime, "1m"))
  );

  const ephemeris: EphemerisData = {};
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value && result.value.length > 0) {
      ephemeris[bodyIds[i]] = result.value[0];
    }
  });

  return ephemeris;
}

export async function fetchTrajectories(
  bodyIds: string[],
  startTime: Date,
  endTime: Date,
  stepSize: string
): Promise<TrajectoryData> {
  const start = formatDate(startTime);
  const end = formatDate(endTime);

  const results = await Promise.allSettled(
    bodyIds.map((id) => fetchSingleBody(id, start, end, stepSize))
  );

  const trajectories: TrajectoryData = {};
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value && result.value.length > 0) {
      trajectories[bodyIds[i]] = result.value;
    }
  });

  return trajectories;
}

export function toThreeUnits(point: EphemerisPoint, scaleDistance: number): EphemerisPoint {
  return {
    x: point.x / KM_PER_UNIT / scaleDistance,
    y: point.y / KM_PER_UNIT / scaleDistance,
    z: point.z / KM_PER_UNIT / scaleDistance,
  };
}

export { KM_PER_UNIT };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/matteo/Desktop/projects/js_websites/universe_map && npx tsc -p tsconfig.app.json --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/services/horizons.ts
git commit -m "feat: create HorizonsService for JPL Horizons API calls and parsing"
```

---

### Task 3: Create EphemerisContext and useEphemeris hook

**Files:**
- Create: `src/hooks/useEphemeris.ts`
- Create: `src/context/ephemeris.tsx`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect, useRef } from "react";
import {
  fetchEphemeris,
  fetchTrajectories,
  EphemerisData,
  TrajectoryData,
} from "../services/horizons";
import { SOLAR_SYSTEM, CelestialBody } from "../data";

export interface UseEphemerisResult {
  positions: EphemerisData | null;
  trajectories: TrajectoryData | null;
  loading: boolean;
  error: boolean;
}

function collectHorizonsIds(body: CelestialBody): string[] {
  const ids = [body.horizonsId];
  for (const child of body.children) {
    ids.push(...collectHorizonsIds(child));
  }
  return ids;
}

function getPlanetIds(): string[] {
  return SOLAR_SYSTEM.children.map((p) => p.horizonsId);
}

function getMoonIds(): string[] {
  const ids: string[] = [];
  for (const planet of SOLAR_SYSTEM.children) {
    for (const moon of planet.children) {
      ids.push(moon.horizonsId);
    }
  }
  return ids;
}

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function useEphemeris(): UseEphemerisResult {
  const [positions, setPositions] = useState<EphemerisData | null>(null);
  const [trajectories, setTrajectories] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const allIds = collectHorizonsIds(SOLAR_SYSTEM);
      // Sun (id "10") is always at origin, but we fetch it anyway for consistency
      const planetIds = getPlanetIds();
      const moonIds = getMoonIds();

      // Fetch positions and trajectories in parallel
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      try {
        const [posResult, planetTrajResult, moonTrajResult] = await Promise.all([
          fetchEphemeris(allIds),
          fetchTrajectories(planetIds, oneYearAgo, now, "1d"),
          fetchTrajectories(moonIds, oneMonthAgo, now, "1d"),
        ]);

        if (cancelled) return;

        const hasPositions = Object.keys(posResult).length > 0;
        if (hasPositions) {
          setPositions(posResult);
          setTrajectories({ ...planetTrajResult, ...moonTrajResult });
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();

    // Periodic refresh of positions only
    intervalRef.current = window.setInterval(async () => {
      const allIds = collectHorizonsIds(SOLAR_SYSTEM);
      try {
        const newPositions = await fetchEphemeris(allIds);
        if (Object.keys(newPositions).length > 0) {
          setPositions(newPositions);
        }
      } catch {
        // Keep last valid positions on failure
      }
    }, REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { positions, trajectories, loading, error };
}
```

- [ ] **Step 2: Create the context**

```typescript
import { createContext } from "react";
import { UseEphemerisResult } from "../hooks/useEphemeris";

export const EphemerisContext = createContext<UseEphemerisResult>({
  positions: null,
  trajectories: null,
  loading: true,
  error: false,
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/matteo/Desktop/projects/js_websites/universe_map && npx tsc -p tsconfig.app.json --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useEphemeris.ts src/context/ephemeris.tsx
git commit -m "feat: create useEphemeris hook and EphemerisContext for real-time positions"
```

---

### Task 4: Update units.tsx

**Files:**
- Modify: `src/helper/units.tsx`

- [ ] **Step 1: Add kmToUnits and simplify**

Replace the entire file:

```typescript
import { CELESTIAL_BODIES, SCALE_SIZE } from "../data";

export const KM_PER_UNIT = 6371; // 1 Three.js unit = 1 Earth radius

export function kmToUnits(km: number): number {
  return km / KM_PER_UNIT;
}

interface EarthUnitSizeProps {
  size: number;
}

export function ScaleEarthUnitSize({ size }: EarthUnitSizeProps) {
  const earth = CELESTIAL_BODIES.find(
    (body) => body.name === "Sun"
  )?.children.find((planet) => planet.name === "Earth");

  if (!earth) throw new Error("Earth not found");
  const SizeCompareToEarth = size / earth.radius;

  if (SCALE_SIZE > 1) {
    const SizeScaled =
      SizeCompareToEarth > 1
        ? SizeCompareToEarth / SCALE_SIZE
        : SizeCompareToEarth + (1 - SizeCompareToEarth) * (SCALE_SIZE / 10);
    return SizeScaled;
  } else if (SCALE_SIZE === 1) {
    return SizeCompareToEarth;
  } else {
    throw new Error("'scale' cannot be lower than 1");
  }
}
```

Note: `ScaleDistance` is removed — positions now come from the API. `ScaleEarthUnitSize` stays because it's used for mesh sizes (planet sphere radii). `kmToUnits` is added for the new position conversion.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/matteo/Desktop/projects/js_websites/universe_map && npx tsc -p tsconfig.app.json --noEmit`
Expected: Errors in Star.tsx, Planet.tsx, CameraFly.tsx that still import `ScaleDistance`. These get fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/helper/units.tsx
git commit -m "feat: add kmToUnits conversion, remove ScaleDistance"
```

---

### Task 5: Create LoadingScreen

**Files:**
- Create: `src/lib/LoadingScreen.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from "react";

interface LoadingScreenProps {
  loading: boolean;
  error: boolean;
}

export default function LoadingScreen({ loading, error }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (error) {
        setShowOffline(true);
        setTimeout(() => setShowOffline(false), 3000);
      }
      setFadeOut(true);
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [loading, error]);

  if (!visible && !showOffline) return null;

  return (
    <>
      {visible && (
        <div
          className={`fixed inset-0 z-[9999999999] bg-black flex items-center justify-center transition-opacity duration-500 ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="text-center text-white">
            <div className="text-lg font-light tracking-[4px] uppercase loading-pulse">
              Loading Solar System
            </div>
            <div className="text-[10px] text-[#666] mt-3 tracking-[2px] uppercase">
              Fetching data from NASA JPL
            </div>
          </div>
        </div>
      )}
      {showOffline && !visible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999999999] bg-[#000000b3] bg-blur-custom text-[#888] text-[11px] px-4 py-2 rounded-lg uppercase tracking-wider">
          Using offline data
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add loading-pulse animation to index.css**

In `src/index.css`, add at the end:

```css
.loading-pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

- [ ] **Step 4: Commit**

```bash
git add src/lib/LoadingScreen.tsx src/index.css
git commit -m "feat: create LoadingScreen with fade-out and offline indicator"
```

---

### Task 6: Create SettingsPanel

**Files:**
- Create: `src/lib/settings/SettingsPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useContext } from "react";
import { IoSettingsSharp } from "react-icons/io5";
import { ScaleDistanceScaleContext } from "../../context/contexts";

interface SettingsPanelProps {
  showOrbits: boolean;
  setShowOrbits: (value: boolean) => void;
}

export default function SettingsPanel({
  showOrbits,
  setShowOrbits,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const contextScaleDistance = useContext(ScaleDistanceScaleContext);
  if (!contextScaleDistance) return null;
  const { scaleDistance, setScaleDistance } = contextScaleDistance;

  return (
    <div className="fixed z-[999999999] top-0 left-0">
      <div
        className={`bg-[#000000b3] bg-blur-custom text-white rounded-br-lg overflow-hidden transition-all duration-300 ${
          open ? "p-4 w-56" : "p-2 w-auto cursor-pointer"
        }`}
        onClick={!open ? () => setOpen(true) : undefined}
      >
        {!open ? (
          <IoSettingsSharp className="text-lg opacity-60 hover:opacity-100 transition-opacity" />
        ) : (
          <>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase tracking-[2px] text-[#888]">
                Settings
              </span>
              <button
                className="text-[#888] hover:text-white text-xs"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Scale distance */}
            <div className="mb-3">
              <div className="text-[10px] text-[#666] uppercase mb-1">
                Scale distance:{" "}
                {scaleDistance === 1 ? "Real" : `1 : ${scaleDistance}`}
              </div>
              <input
                onChange={(e) => setScaleDistance(Number(e.target.value))}
                type="range"
                min="1"
                max="1000"
                value={scaleDistance}
                className="custom-range w-full"
              />
            </div>

            {/* Show orbits */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#666] uppercase">
                Show orbits
              </span>
              <button
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  showOrbits ? "bg-[#4a90d9]" : "bg-[#333]"
                }`}
                onClick={() => setShowOrbits(!showOrbits)}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${
                    showOrbits ? "left-4" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add src/lib/settings/SettingsPanel.tsx
git commit -m "feat: create collapsible SettingsPanel with scale and orbit controls"
```

---

### Task 7: Update Star.tsx to use ephemeris positions

**Files:**
- Modify: `src/lib/stars/Star.tsx`

- [ ] **Step 1: Update imports and planet positioning**

Read the current file. Then make these changes:

Replace imports:

```tsx
import { useRef, useContext } from "react";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { useLoader, useFrame, useThree } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import { ScaleEarthUnitSize, ScaleDistance } from "../../helper/units";
import Planet from "../planets/Planet";
import * as THREE from "three";
```

With:

```tsx
import { useRef, useContext } from "react";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import { useLoader, useFrame, useThree } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import { ScaleEarthUnitSize } from "../../helper/units";
import { KM_PER_UNIT } from "../../services/horizons";
import Planet from "../planets/Planet";
import * as THREE from "three";
```

Add ephemeris context read inside the component, after the existing `scaleDistance` read:

```tsx
const { positions } = useContext(EphemerisContext);
```

Replace the planets map section:

```tsx
  const planets = starObj.children.map((planet) => {
    let planetPosition: [number, number, number];

    if (positions && positions[planet.horizonsId]) {
      const pos = positions[planet.horizonsId];
      planetPosition = [
        pos.x / KM_PER_UNIT / scaleDistance,
        pos.y / KM_PER_UNIT / scaleDistance,
        pos.z / KM_PER_UNIT / scaleDistance,
      ];
    } else {
      // Fallback to static position along Z axis
      const fallbackZ =
        planet.distanceFromParent / KM_PER_UNIT / scaleDistance +
        ScaleEarthUnitSize({ size: starObj.radius }) +
        ScaleEarthUnitSize({ size: planet.radius });
      planetPosition = [0, 0, fallbackZ];
    }

    return (
      <Planet
        map={planet.map}
        position={planetPosition}
        size={ScaleEarthUnitSize({ size: planet.radius })}
        rotation={planet.info.axialTilt}
        key={`${starObj.id}-${planet.id}`}
        planetObj={planet}
        starObj={starObj}
      />
    );
  });
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add src/lib/stars/Star.tsx
git commit -m "feat: update Star to position planets from Horizons API with static fallback"
```

---

### Task 8: Update Planet.tsx — ephemeris positions for moons + orbit lines

**Files:**
- Modify: `src/lib/planets/Planet.tsx`

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { useState, useContext, useRef } from "react";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { useLoader, useThree, useFrame } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import { ScaleEarthUnitSize, ScaleDistance } from "../../helper/units";
import Moon from "../moons/Moon";
import * as THREE from "three";
import { Html } from "@react-three/drei";
```

With:

```tsx
import { useState, useContext, useRef, useMemo } from "react";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import { useLoader, useThree, useFrame } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import { ScaleEarthUnitSize } from "../../helper/units";
import { KM_PER_UNIT } from "../../services/horizons";
import Moon from "../moons/Moon";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
```

- [ ] **Step 2: Add ephemeris context and update moon positioning**

Inside the component, after the existing `scaleDistance` read, add:

```tsx
const { positions, trajectories } = useContext(EphemerisContext);
```

Replace the moons map:

```tsx
  const moons = planetObj.children.map((moon) => {
    let moonPosition: [number, number, number];

    if (positions && positions[moon.horizonsId] && positions[planetObj.horizonsId]) {
      // Moon position is heliocentric — convert to planet-relative
      const moonPos = positions[moon.horizonsId];
      const planetPos = positions[planetObj.horizonsId];
      moonPosition = [
        (moonPos.x - planetPos.x) / KM_PER_UNIT / scaleDistance,
        (moonPos.y - planetPos.y) / KM_PER_UNIT / scaleDistance,
        (moonPos.z - planetPos.z) / KM_PER_UNIT / scaleDistance,
      ];
    } else {
      // Fallback to static offset
      const offset =
        moon.distanceFromParent / KM_PER_UNIT / scaleDistance +
        ScaleEarthUnitSize({ size: planetObj.radius }) +
        ScaleEarthUnitSize({ size: moon.radius });
      moonPosition = [offset, offset, 0];
    }

    return (
      <Moon
        position={moonPosition}
        size={ScaleEarthUnitSize({ size: moon.radius })}
        key={`${starObj.id}-${planetObj.id}-${moon.id}`}
      />
    );
  });
```

- [ ] **Step 3: Add orbit trajectory line**

Inside the component, before the return statement, add the orbit line computation. The `showOrbits` prop needs to be added to `PlanetProps`:

Add to the interface:

```tsx
  showOrbits?: boolean;
```

Add to the destructured props:

```tsx
  showOrbits = true,
```

Add the orbit points memo:

```tsx
  const orbitPoints = useMemo(() => {
    if (!trajectories || !trajectories[planetObj.horizonsId]) return null;
    return trajectories[planetObj.horizonsId].map(
      (p) =>
        new THREE.Vector3(
          p.x / KM_PER_UNIT / scaleDistance,
          p.y / KM_PER_UNIT / scaleDistance,
          p.z / KM_PER_UNIT / scaleDistance
        )
    );
  }, [trajectories, planetObj.horizonsId, scaleDistance]);
```

In the return JSX, right before `{moons}`, add:

```tsx
      {showOrbits && orbitPoints && orbitPoints.length > 1 && (
        <group position={position.map((v: number) => -v) as [number, number, number]}>
          <Line
            points={orbitPoints}
            color="white"
            lineWidth={0.5}
            transparent
            opacity={0.1}
          />
        </group>
      )}
```

Note: The orbit line is in world coordinates, but the planet group is positioned at `position`. We need to negate the planet position to draw the line in world space. The `group` wrapper with negative position offsets the planet group's position, placing the line correctly.

Wait — actually the orbit trajectory points are already in world coordinates (heliocentric). But the Planet component is positioned at its world position via the `position` prop on the outer group. The Line needs to be drawn in world space. So we negate the group position to get back to world space.

However, the Line component from drei renders relative to its parent. Since the planet's outer `<group>` is at `position`, we need the Line's parent to be at `[0,0,0]` world. Wrap the Line in a group with position negated:

```tsx
position={[-(position as [number, number, number])[0], -(position as [number, number, number])[1], -(position as [number, number, number])[2]]}
```

This is cleaner with a variable:

```tsx
  const negPosition: [number, number, number] = [
    -(position as [number, number, number])[0],
    -(position as [number, number, number])[1],
    -(position as [number, number, number])[2],
  ];
```

Then in JSX:

```tsx
      {showOrbits && orbitPoints && orbitPoints.length > 1 && (
        <group position={negPosition}>
          <Line
            points={orbitPoints}
            color="white"
            lineWidth={0.5}
            transparent
            opacity={0.1}
          />
        </group>
      )}
```

- [ ] **Step 4: Verify TypeScript compiles**

- [ ] **Step 5: Commit**

```bash
git add src/lib/planets/Planet.tsx
git commit -m "feat: update Planet with ephemeris moon positions and orbit trajectory lines"
```

---

### Task 9: Update CameraFly to use ephemeris positions

**Files:**
- Modify: `src/lib/camera/CameraFly.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { useContext, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CameraNavigationContext } from "../../context/cameraNavigation";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import { ScaleEarthUnitSize } from "../../helper/units";
import { SOLAR_SYSTEM, CelestialBody } from "../../data";
import { KM_PER_UNIT, EphemerisData } from "../../services/horizons";

interface CameraFlyProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

function computeBodyPosition(
  body: CelestialBody,
  positions: EphemerisData,
  scaleDistance: number
): THREE.Vector3 {
  const pos = positions[body.horizonsId];
  if (pos) {
    return new THREE.Vector3(
      pos.x / KM_PER_UNIT / scaleDistance,
      pos.y / KM_PER_UNIT / scaleDistance,
      pos.z / KM_PER_UNIT / scaleDistance
    );
  }

  // Fallback: static position along Z axis
  if (body.type === "star") return new THREE.Vector3(0, 0, 0);

  const fallbackZ =
    body.distanceFromParent / KM_PER_UNIT / scaleDistance +
    ScaleEarthUnitSize({ size: SOLAR_SYSTEM.radius }) +
    ScaleEarthUnitSize({ size: body.radius });
  return new THREE.Vector3(0, 0, fallbackZ);
}

export default function CameraFly({ controlsRef }: CameraFlyProps) {
  const cameraNav = useContext(CameraNavigationContext);
  const contextScaleDistance = useContext(ScaleDistanceScaleContext);
  const { positions } = useContext(EphemerisContext);

  const { camera } = useThree();

  const isAnimating = useRef(false);
  const animationProgress = useRef(0);
  const animationDuration = useRef(1.5);
  const startPosition = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endPosition = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const currentBodyRadius = useRef(0);
  const currentBodyPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!cameraNav || !contextScaleDistance || !positions) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const { flyTo, setFlyTo } = cameraNav;
    const { scaleDistance } = contextScaleDistance;

    if (flyTo && !isAnimating.current) {
      const bodyPos = computeBodyPosition(flyTo, positions, scaleDistance);
      const bodyRadius = ScaleEarthUnitSize({ size: flyTo.radius });

      const cameraTarget = new THREE.Vector3(
        bodyPos.x,
        bodyPos.y + bodyRadius * 1.5,
        bodyPos.z - bodyRadius * 3
      );

      const dist = camera.position.distanceTo(cameraTarget);
      const maxDist = 500000;
      const t = Math.min(dist / maxDist, 1);
      animationDuration.current = 0.8 + t * 2.2;

      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      endPosition.current.copy(cameraTarget);
      endTarget.current.copy(bodyPos);
      currentBodyRadius.current = bodyRadius;
      currentBodyPos.current.copy(bodyPos);

      animationProgress.current = 0;
      isAnimating.current = true;
      controls.enabled = false;

      setFlyTo(null);
    }

    if (isAnimating.current) {
      animationProgress.current += delta / animationDuration.current;
      const rawT = Math.min(animationProgress.current, 1);
      const t = 1 - Math.pow(1 - rawT, 3);

      camera.position.lerpVectors(startPosition.current, endPosition.current, t);
      controls.target.lerpVectors(startTarget.current, endTarget.current, t);
      controls.update();

      if (rawT >= 1) {
        isAnimating.current = false;
        controls.enabled = true;
        controls.minDistance = currentBodyRadius.current * 1.5;
        controls.update();
      }
    }

    if (!isAnimating.current && currentBodyRadius.current > 0) {
      const distToBody = camera.position.distanceTo(currentBodyPos.current);
      if (distToBody > currentBodyRadius.current * 20) {
        controls.minDistance = 0;
        currentBodyRadius.current = 0;
      }
    }
  });

  return null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add src/lib/camera/CameraFly.tsx
git commit -m "feat: update CameraFly to use ephemeris positions with static fallback"
```

---

### Task 10: Wire everything into App.tsx and main.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Update App.tsx imports**

Add new imports:

```tsx
import { useEphemeris } from "./hooks/useEphemeris";
import { EphemerisContext } from "./context/ephemeris";
import LoadingScreen from "./lib/LoadingScreen";
import SettingsPanel from "./lib/settings/SettingsPanel";
```

- [ ] **Step 2: Add state and context provider in App function**

Inside the App function, after the existing state declarations, add:

```tsx
const ephemeris = useEphemeris();
const [showOrbits, setShowOrbits] = useState(true);
```

Wrap the entire return JSX in the EphemerisContext provider:

```tsx
return (
  <EphemerisContext.Provider value={ephemeris}>
    <LoadingScreen loading={ephemeris.loading} error={ephemeris.error} />
    <div className="noselect">
      {/* ... rest of existing JSX ... */}
    </div>
  </EphemerisContext.Provider>
);
```

- [ ] **Step 3: Replace the old slider box with SettingsPanel**

Remove the entire old slider div (lines 92-112 in current file):

```tsx
      <div className="fixed z-[999999999] p-1 px-2 rounded-br-md bg-[#00000065] top-0 left-0 text-[#fff] text-[11px] bg-blur-custom">
        ...
      </div>
```

Replace with:

```tsx
      <SettingsPanel showOrbits={showOrbits} setShowOrbits={setShowOrbits} />
```

- [ ] **Step 4: Pass showOrbits to Star → Planet**

Update the Star component usage to pass showOrbits. Since Star passes props to Planet, add `showOrbits` as a prop through the chain. 

In Star.tsx, add to StarProps:

```tsx
showOrbits?: boolean;
```

In Star.tsx, pass to Planet:

```tsx
<Planet
  ...
  showOrbits={showOrbits}
/>
```

In App.tsx, pass to Star:

```tsx
<Star
  ...
  showOrbits={showOrbits}
/>
```

- [ ] **Step 5: Conditionally render Canvas only after loading**

Wrap the Canvas in a condition so it only renders after loading:

```tsx
{!ephemeris.loading && (
  <Canvas ...>
    ...
  </Canvas>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd /home/matteo/Desktop/projects/js_websites/universe_map && npx tsc -p tsconfig.app.json --noEmit`
Expected: Zero errors

- [ ] **Step 7: Manual test in browser**

Open `http://localhost:5317`. Verify:
1. Loading screen appears while data fetches
2. Loading screen fades out when data arrives
3. Planets are positioned in 3D (not in a line along Z)
4. Orbit trajectory lines visible (white, faint)
5. Settings panel (gear icon top-left) works — slider changes scale, orbit toggle works
6. Fly-to still works from the card
7. If you disconnect internet and reload — fallback to static data with "offline" indicator

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/main.tsx src/lib/stars/Star.tsx
git commit -m "feat: wire ephemeris provider, loading screen, and settings panel into app"
```
