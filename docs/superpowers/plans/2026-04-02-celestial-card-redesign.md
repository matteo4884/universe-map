# Celestial Card Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the side card with hierarchical navigation (Sun → Planet → Moon), enriched data, and mobile bottom sheet support.

**Architecture:** Unified `CelestialBody` type replaces 3 old types. A single `CelestialCard` component renders any body's detail + children list. Navigation is path-based (array of child indices). Mobile uses a bottom sheet wrapper around the same detail component.

**Tech Stack:** React, TypeScript, Tailwind CSS, react-icons (FaEye, MdArrowForwardIos, MdMenu), Three.js/R3F (CameraFly updates)

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/data.tsx` | Rewrite | `CelestialBody` type + enriched solar system data |
| `src/context/cameraNavigation.tsx` | Modify | Change `PlanetParam` → `CelestialBody` |
| `src/helper/units.tsx` | Modify | Update imports to use `CelestialBody` |
| `src/lib/stars/Star.tsx` | Modify | Use `CelestialBody` instead of `StarParam` |
| `src/lib/planets/Planet.tsx` | Modify | Use `CelestialBody` instead of `PlanetParam` |
| `src/lib/moons/Moon.tsx` | No change | Already generic enough (position + size only) |
| `src/lib/camera/CameraFly.tsx` | Modify | Use `CelestialBody`, handle star/moon fly-to |
| `src/lib/cards/CelestialDetail.tsx` | Create | Detail layout: hero, stats, atmosphere, fun fact, children |
| `src/lib/cards/CelestialCard.tsx` | Create | Path navigation, transitions, desktop panel |
| `src/lib/cards/MobileSheet.tsx` | Create | Bottom sheet wrapper for mobile |
| `src/App.tsx` | Modify | Use CelestialCard, remove old Card |
| `src/index.css` | Modify | Add transition and mobile sheet CSS |
| `src/lib/cards/Card.tsx` | Delete | Replaced by CelestialCard |

---

### Task 1: Rewrite data model with enriched data

**Files:**
- Rewrite: `src/data.tsx`

- [ ] **Step 1: Replace entire file with new CelestialBody type and data**

Replace the full contents of `src/data.tsx` with:

```tsx
export const SCALE_SIZE: number = 1;

export interface CelestialBody {
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

export const SOLAR_SYSTEM: CelestialBody = {
  id: 0,
  type: "star",
  name: "Sun",
  map: "g",
  image: "sun.png",
  radius: 696340,
  distanceFromParent: 0,
  info: {
    mass: "1.989 × 10³⁰ kg",
    gravity: 274,
    temperature: 5500,
    dayLength: "25.4 Earth days",
    yearLength: "225 million years",
    orbitalSpeed: 220,
    axialTilt: 7.25,
    eccentricity: 0,
    magneticField: true,
    rings: false,
    atmosphere: ["H 73.46%", "He 24.85%"],
    funFact:
      "The Sun accounts for 99.86% of the total mass of the Solar System.",
  },
  children: [
    {
      id: 1,
      type: "planet",
      name: "Mercury",
      map: "mercury",
      image: "mercury.png",
      radius: 2439.7,
      distanceFromParent: 57910000,
      info: {
        mass: "3.301 × 10²³ kg",
        gravity: 3.7,
        temperature: 167,
        dayLength: "58d 15h",
        yearLength: "88 days",
        orbitalSpeed: 47.4,
        axialTilt: 0.03,
        eccentricity: 0.2056,
        magneticField: true,
        rings: false,
        atmosphere: [],
        funFact:
          "Mercury's day is longer than its year — one solar day lasts 176 Earth days.",
      },
      children: [],
    },
    {
      id: 2,
      type: "planet",
      name: "Venus",
      map: "venus",
      image: "venus.png",
      radius: 6051.8,
      distanceFromParent: 108200000,
      info: {
        mass: "4.867 × 10²⁴ kg",
        gravity: 8.87,
        temperature: 464,
        dayLength: "243 Earth days",
        yearLength: "225 days",
        orbitalSpeed: 35.0,
        axialTilt: 177.36,
        eccentricity: 0.0067,
        magneticField: false,
        rings: false,
        atmosphere: ["CO₂ 96.5%", "N₂ 3.5%"],
        funFact:
          "Venus rotates backwards compared to most planets, and its day is longer than its year.",
      },
      children: [],
    },
    {
      id: 3,
      type: "planet",
      name: "Earth",
      map: "earth",
      image: "earth.png",
      radius: 6371,
      distanceFromParent: 149600000,
      info: {
        mass: "5.972 × 10²⁴ kg",
        gravity: 9.81,
        temperature: 15,
        dayLength: "23h 56m",
        yearLength: "365.25 days",
        orbitalSpeed: 29.8,
        axialTilt: 23.44,
        eccentricity: 0.0167,
        magneticField: true,
        rings: false,
        atmosphere: ["N₂ 78%", "O₂ 21%", "Ar 0.9%"],
        funFact:
          "Only known planet to harbor life. 71% of its surface is covered by water.",
      },
      children: [
        {
          id: 1,
          type: "moon",
          name: "Moon",
          map: "moon",
          image: "moon.png",
          radius: 1737,
          distanceFromParent: 384400,
          info: {
            mass: "7.342 × 10²² kg",
            gravity: 1.62,
            temperature: -20,
            dayLength: "27.3 Earth days",
            yearLength: "27.3 days",
            orbitalSpeed: 1.0,
            axialTilt: 1.54,
            eccentricity: 0.0549,
            magneticField: false,
            rings: false,
            atmosphere: [],
            funFact:
              "The Moon is slowly drifting away from Earth at about 3.8 cm per year.",
          },
          children: [],
        },
      ],
    },
    {
      id: 4,
      type: "planet",
      name: "Mars",
      map: "mars",
      image: "mars.png",
      radius: 3389.5,
      distanceFromParent: 227900000,
      info: {
        mass: "6.417 × 10²³ kg",
        gravity: 3.72,
        temperature: -65,
        dayLength: "24h 37m",
        yearLength: "687 days",
        orbitalSpeed: 24.1,
        axialTilt: 25.19,
        eccentricity: 0.0935,
        magneticField: false,
        rings: false,
        atmosphere: ["CO₂ 95.3%", "N₂ 2.7%", "Ar 1.6%"],
        funFact:
          "Home to Olympus Mons, the tallest volcano in the Solar System at 21.9 km high.",
      },
      children: [
        {
          id: 1,
          type: "moon",
          name: "Phobos",
          map: "phobos",
          image: "phobos.png",
          radius: 11.267,
          distanceFromParent: 9376,
          info: {
            mass: "1.066 × 10¹⁶ kg",
            gravity: 0.0057,
            temperature: -40,
            dayLength: "7h 39m",
            yearLength: "0.319 days",
            orbitalSpeed: 2.14,
            axialTilt: 0,
            eccentricity: 0.0151,
            magneticField: false,
            rings: false,
            atmosphere: [],
            funFact:
              "Phobos orbits Mars faster than Mars rotates, rising in the west and setting in the east.",
          },
          children: [],
        },
        {
          id: 2,
          type: "moon",
          name: "Deimos",
          map: "deimos",
          image: "deimos.png",
          radius: 6.2,
          distanceFromParent: 23463,
          info: {
            mass: "1.476 × 10¹⁵ kg",
            gravity: 0.003,
            temperature: -40,
            dayLength: "30h 18m",
            yearLength: "1.263 days",
            orbitalSpeed: 1.35,
            axialTilt: 0,
            eccentricity: 0.00033,
            magneticField: false,
            rings: false,
            atmosphere: [],
            funFact:
              "Deimos is one of the smallest moons in the Solar System, only about 6 km in radius.",
          },
          children: [],
        },
      ],
    },
    {
      id: 5,
      type: "planet",
      name: "Jupiter",
      map: "jupiter",
      image: "jupiter.png",
      radius: 69911,
      distanceFromParent: 778500000,
      info: {
        mass: "1.898 × 10²⁷ kg",
        gravity: 24.79,
        temperature: -110,
        dayLength: "9h 56m",
        yearLength: "4,333 days",
        orbitalSpeed: 13.1,
        axialTilt: 3.13,
        eccentricity: 0.0489,
        magneticField: true,
        rings: true,
        atmosphere: ["H₂ 89.8%", "He 10.2%"],
        funFact:
          "Jupiter's Great Red Spot is a storm larger than Earth that has been raging for over 350 years.",
      },
      children: [],
    },
    {
      id: 6,
      type: "planet",
      name: "Saturn",
      map: "saturn",
      image: "saturn.png",
      radius: 58232,
      distanceFromParent: 1433000000,
      info: {
        mass: "5.683 × 10²⁶ kg",
        gravity: 10.44,
        temperature: -140,
        dayLength: "10h 42m",
        yearLength: "10,759 days",
        orbitalSpeed: 9.7,
        axialTilt: 26.73,
        eccentricity: 0.0565,
        magneticField: true,
        rings: true,
        atmosphere: ["H₂ 96.3%", "He 3.25%"],
        funFact:
          "Saturn's density is so low that it would float in water if there were an ocean large enough.",
      },
      children: [],
    },
    {
      id: 7,
      type: "planet",
      name: "Uranus",
      map: "uranus",
      image: "uranus.png",
      radius: 25362,
      distanceFromParent: 2871000000,
      info: {
        mass: "8.681 × 10²⁵ kg",
        gravity: 8.87,
        temperature: -195,
        dayLength: "17h 14m",
        yearLength: "30,687 days",
        orbitalSpeed: 6.8,
        axialTilt: 97.77,
        eccentricity: 0.0457,
        magneticField: true,
        rings: true,
        atmosphere: ["H₂ 82.5%", "He 15.2%", "CH₄ 2.3%"],
        funFact:
          "Uranus rotates on its side with an axial tilt of 98°, likely caused by a collision with an Earth-sized object.",
      },
      children: [],
    },
    {
      id: 8,
      type: "planet",
      name: "Neptune",
      map: "neptune",
      image: "neptune.png",
      radius: 24622,
      distanceFromParent: 4495000000,
      info: {
        mass: "1.024 × 10²⁶ kg",
        gravity: 11.15,
        temperature: -200,
        dayLength: "16h 6m",
        yearLength: "60,190 days",
        orbitalSpeed: 5.4,
        axialTilt: 28.32,
        eccentricity: 0.0113,
        magneticField: true,
        rings: true,
        atmosphere: ["H₂ 80%", "He 19%", "CH₄ 1.5%"],
        funFact:
          "Neptune has the strongest winds in the Solar System, reaching up to 2,100 km/h.",
      },
      children: [],
    },
  ],
};

// Backward-compatible export: array wrapping the root for 3D rendering code
export const CELESTIAL_BODIES: CelestialBody[] = [SOLAR_SYSTEM];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors in files that still import old types (`StarParam`, `PlanetParam`, `MoonParam`). This is expected — they will be fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/data.tsx
git commit -m "feat: rewrite data model with unified CelestialBody type and enriched planet data"
```

---

### Task 2: Update context and helper to use CelestialBody

**Files:**
- Modify: `src/context/cameraNavigation.tsx`
- Modify: `src/helper/units.tsx`

- [ ] **Step 1: Update cameraNavigation.tsx**

Replace the full contents of `src/context/cameraNavigation.tsx`:

```tsx
import { createContext, useState } from "react";
import { CelestialBody } from "../data";

export type CameraNavigationContextType = {
  flyTo: CelestialBody | null;
  setFlyTo: (body: CelestialBody | null) => void;
};

export const CameraNavigationContext = createContext<
  CameraNavigationContextType | undefined
>(undefined);

export function CameraNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flyTo, setFlyTo] = useState<CelestialBody | null>(null);

  return (
    <CameraNavigationContext.Provider value={{ flyTo, setFlyTo }}>
      {children}
    </CameraNavigationContext.Provider>
  );
}
```

- [ ] **Step 2: Update units.tsx imports**

In `src/helper/units.tsx`, replace:

```tsx
import { CELESTIAL_BODIES } from "../data";
import { SCALE_SIZE } from "../data";
```

With:

```tsx
import { CELESTIAL_BODIES, SCALE_SIZE } from "../data";
```

No other changes needed — `units.tsx` only accesses `.name`, `.radius`, and `.planets` (now `.children`) on the bodies. Update the Earth lookup:

Replace:

```tsx
export function ScaleEarthUnitSize({ size }: EarthUnitSizeProps) {
  const earth = CELESTIAL_BODIES.find(
    (body) => body.name === "sun"
  )?.planets.find((planet) => planet.name === "earth");
```

With:

```tsx
export function ScaleEarthUnitSize({ size }: EarthUnitSizeProps) {
  const earth = CELESTIAL_BODIES.find(
    (body) => body.name === "Sun"
  )?.children.find((planet) => planet.name === "Earth");
```

And in `ScaleDistance`:

Replace:

```tsx
export function ScaleDistance({ distance, scale }: ScaleDistanceProps) {
  const earth = CELESTIAL_BODIES.find(
    (body) => body.name === "sun"
  )?.planets.find((planet) => planet.name === "earth");
```

With:

```tsx
export function ScaleDistance({ distance, scale }: ScaleDistanceProps) {
  const earth = CELESTIAL_BODIES.find(
    (body) => body.name === "Sun"
  )?.children.find((planet) => planet.name === "Earth");
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors remain in Star.tsx, Planet.tsx, CameraFly.tsx (old types). That's ok.

- [ ] **Step 4: Commit**

```bash
git add src/context/cameraNavigation.tsx src/helper/units.tsx
git commit -m "feat: update context and units to use CelestialBody type"
```

---

### Task 3: Update 3D components (Star, Planet) to use CelestialBody

**Files:**
- Modify: `src/lib/stars/Star.tsx`
- Modify: `src/lib/planets/Planet.tsx`

- [ ] **Step 1: Update Star.tsx**

In `src/lib/stars/Star.tsx`, replace the import and interface:

```tsx
import { StarParam } from "../../data";
```

With:

```tsx
import { CelestialBody } from "../../data";
```

Replace the interface:

```tsx
interface StarProps {
  map: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
  starObj: StarParam;
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}
```

With:

```tsx
interface StarProps {
  map: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
  starObj: CelestialBody;
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}
```

In the planets map, replace `starObj.planets.map` with `starObj.children.map`, and update planet property accesses. Replace:

```tsx
  const planets = starObj.planets.map((planet) => (
    <Planet
      map={planet.map}
      position={[
        ScaleDistance({ distance: 0, scale: scaleDistance }),
        ScaleDistance({ distance: 0, scale: scaleDistance }),
        ScaleDistance({
          distance: planet.distanceFromStar,
          scale: scaleDistance,
        }) +
          ScaleEarthUnitSize({ size: starObj.radius }) +
          ScaleEarthUnitSize({ size: planet.radius }),
      ]}
      size={ScaleEarthUnitSize({ size: planet.radius })}
      rotation={planet.info.axialTilt}
      key={`${starObj.id}-${planet.id}`}
      planetObj={planet}
      starObj={starObj}
    />
  ));
```

With:

```tsx
  const planets = starObj.children.map((planet) => (
    <Planet
      map={planet.map}
      position={[
        ScaleDistance({ distance: 0, scale: scaleDistance }),
        ScaleDistance({ distance: 0, scale: scaleDistance }),
        ScaleDistance({
          distance: planet.distanceFromParent,
          scale: scaleDistance,
        }) +
          ScaleEarthUnitSize({ size: starObj.radius }) +
          ScaleEarthUnitSize({ size: planet.radius }),
      ]}
      size={ScaleEarthUnitSize({ size: planet.radius })}
      rotation={planet.info.axialTilt}
      key={`${starObj.id}-${planet.id}`}
      planetObj={planet}
      starObj={starObj}
    />
  ));
```

- [ ] **Step 2: Update Planet.tsx**

In `src/lib/planets/Planet.tsx`, replace imports:

```tsx
import { PlanetParam, StarParam } from "../../data";
```

With:

```tsx
import { CelestialBody } from "../../data";
```

Replace the interface:

```tsx
interface PlanetProps {
  map: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
  rotation: number;
  planetObj: PlanetParam;
  starObj: StarParam;
}
```

With:

```tsx
interface PlanetProps {
  map: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
  rotation: number;
  planetObj: CelestialBody;
  starObj: CelestialBody;
}
```

In the moons map, replace `planetObj.moons.map` with `planetObj.children.map`, and update `moon.distanceFromPlanet` to `moon.distanceFromParent`. Replace:

```tsx
  const moons = planetObj.moons.map((moon) => (
    <Moon
      position={[
        ScaleDistance({
          distance: moon.distanceFromPlanet,
          scale: scaleDistance,
        }) +
          ScaleEarthUnitSize({ size: planetObj.radius }) +
          ScaleEarthUnitSize({ size: moon.radius }),
        ScaleDistance({
          distance: moon.distanceFromPlanet,
          scale: scaleDistance,
        }) +
          ScaleEarthUnitSize({ size: planetObj.radius }) +
          ScaleEarthUnitSize({ size: moon.radius }),
        0,
      ]}
      size={ScaleEarthUnitSize({ size: moon.radius })}
      key={`${starObj.id}-${planetObj.id}-${moon.id}`}
    />
  ));
```

With:

```tsx
  const moons = planetObj.children.map((moon) => (
    <Moon
      position={[
        ScaleDistance({
          distance: moon.distanceFromParent,
          scale: scaleDistance,
        }) +
          ScaleEarthUnitSize({ size: planetObj.radius }) +
          ScaleEarthUnitSize({ size: moon.radius }),
        ScaleDistance({
          distance: moon.distanceFromParent,
          scale: scaleDistance,
        }) +
          ScaleEarthUnitSize({ size: planetObj.radius }) +
          ScaleEarthUnitSize({ size: moon.radius }),
        0,
      ]}
      size={ScaleEarthUnitSize({ size: moon.radius })}
      key={`${starObj.id}-${planetObj.id}-${moon.id}`}
    />
  ));
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Errors may remain only in CameraFly.tsx and App.tsx (old types still). Star/Planet should be clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stars/Star.tsx src/lib/planets/Planet.tsx
git commit -m "feat: update Star and Planet components to use CelestialBody type"
```

---

### Task 4: Update CameraFly to handle all body types

**Files:**
- Modify: `src/lib/camera/CameraFly.tsx`

- [ ] **Step 1: Replace full contents of CameraFly.tsx**

```tsx
import { useContext, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CameraNavigationContext } from "../../context/cameraNavigation";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { ScaleDistance, ScaleEarthUnitSize } from "../../helper/units";
import { SOLAR_SYSTEM, CelestialBody } from "../../data";

interface CameraFlyProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

function computeBodyPosition(
  body: CelestialBody,
  scaleDistance: number
): THREE.Vector3 {
  if (body.type === "star") {
    return new THREE.Vector3(0, 0, 0);
  }

  if (body.type === "planet") {
    const star = SOLAR_SYSTEM;
    const x = ScaleDistance({ distance: 0, scale: scaleDistance });
    const y = ScaleDistance({ distance: 0, scale: scaleDistance });
    const z =
      ScaleDistance({ distance: body.distanceFromParent, scale: scaleDistance }) +
      ScaleEarthUnitSize({ size: star.radius }) +
      ScaleEarthUnitSize({ size: body.radius });
    return new THREE.Vector3(x, y, z);
  }

  // Moon: find parent planet, compute planet pos, then add moon offset
  if (body.type === "moon") {
    const parentPlanet = SOLAR_SYSTEM.children.find((p) =>
      p.children.some((m) => m.id === body.id && m.name === body.name)
    );
    if (!parentPlanet) return new THREE.Vector3(0, 0, 0);

    const planetPos = computeBodyPosition(parentPlanet, scaleDistance);
    const moonOffset =
      ScaleDistance({ distance: body.distanceFromParent, scale: scaleDistance }) +
      ScaleEarthUnitSize({ size: parentPlanet.radius }) +
      ScaleEarthUnitSize({ size: body.radius });

    return new THREE.Vector3(
      planetPos.x + moonOffset,
      planetPos.y + moonOffset,
      planetPos.z
    );
  }

  return new THREE.Vector3(0, 0, 0);
}

export default function CameraFly({ controlsRef }: CameraFlyProps) {
  const cameraNav = useContext(CameraNavigationContext);
  const contextScaleDistance = useContext(ScaleDistanceScaleContext);

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
    if (!cameraNav || !contextScaleDistance) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const { flyTo, setFlyTo } = cameraNav;
    const { scaleDistance } = contextScaleDistance;

    // Start a new fly-to animation
    if (flyTo && !isAnimating.current) {
      const bodyPos = computeBodyPosition(flyTo, scaleDistance);
      const bodyRadius = ScaleEarthUnitSize({ size: flyTo.radius });

      // Camera landing position: radius * 3 in front, offset up by radius * 1.5
      const cameraTarget = new THREE.Vector3(
        bodyPos.x,
        bodyPos.y + bodyRadius * 1.5,
        bodyPos.z - bodyRadius * 3
      );

      // Calculate animation duration proportional to distance (0.8s - 3s)
      const dist = camera.position.distanceTo(cameraTarget);
      const maxDist = 500000;
      const t = Math.min(dist / maxDist, 1);
      animationDuration.current = 0.8 + t * 2.2;

      // Store start/end state
      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      endPosition.current.copy(cameraTarget);
      endTarget.current.copy(bodyPos);
      currentBodyRadius.current = bodyRadius;
      currentBodyPos.current.copy(bodyPos);

      // Begin animation
      animationProgress.current = 0;
      isAnimating.current = true;
      controls.enabled = false;

      setFlyTo(null);
    }

    // Animate
    if (isAnimating.current) {
      animationProgress.current += delta / animationDuration.current;
      const rawT = Math.min(animationProgress.current, 1);

      // Ease-out cubic: 1 - (1 - t)^3
      const t = 1 - Math.pow(1 - rawT, 3);

      camera.position.lerpVectors(startPosition.current, endPosition.current, t);
      controls.target.lerpVectors(startTarget.current, endTarget.current, t);
      controls.update();

      // Animation complete
      if (rawT >= 1) {
        isAnimating.current = false;
        controls.enabled = true;
        controls.minDistance = currentBodyRadius.current * 1.5;
        controls.update();
      }
    }

    // minDistance reset: when far enough from body, remove the constraint
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

Run: `npx tsc --noEmit`
Expected: Only App.tsx errors remain (old Card/StarParam imports).

- [ ] **Step 3: Commit**

```bash
git add src/lib/camera/CameraFly.tsx
git commit -m "feat: update CameraFly to handle star, planet, and moon fly-to with CelestialBody"
```

---

### Task 5: Create CelestialDetail component

**Files:**
- Create: `src/lib/cards/CelestialDetail.tsx`

- [ ] **Step 1: Create CelestialDetail.tsx**

```tsx
import { useContext } from "react";
import { CelestialBody } from "../../data";
import { FaEye } from "react-icons/fa";
import { CameraNavigationContext } from "../../context/cameraNavigation";

interface CelestialDetailProps {
  body: CelestialBody;
  onSelectChild: (index: number) => void;
}

export default function CelestialDetail({
  body,
  onSelectChild,
}: CelestialDetailProps) {
  const cameraNav = useContext(CameraNavigationContext);

  const typeLabel =
    body.type === "star"
      ? "Star"
      : body.type === "planet"
        ? body.info.atmosphere.length > 0 &&
          body.info.gravity > 5 &&
          body.radius > 10000
          ? "Gas Giant"
          : "Rocky Planet"
        : "Moon";

  return (
    <div className="flex flex-col gap-4">
      {/* Hero section */}
      <div className="flex gap-4 items-center">
        <img
          src={`/images/${body.image}`}
          alt={body.name}
          className="w-28 h-28 object-contain flex-shrink-0"
        />
        <div>
          <div className="text-2xl font-bold uppercase tracking-wider">
            {body.name}
          </div>
          <div className="text-[10px] text-[#888] uppercase tracking-[3px] mb-3">
            {typeLabel}
          </div>
          <div className="text-xs text-[#aaa] leading-relaxed">
            <div>
              Radius: <span className="text-white">{body.radius.toLocaleString()} km</span>
            </div>
            <div>
              Mass: <span className="text-white">{body.info.mass}</span>
            </div>
            <div>
              Temp: <span className="text-white">{body.info.temperature}°C</span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#ffffff15]" />

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">Day</div>
          <div className="text-sm font-semibold">{body.info.dayLength}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">Year</div>
          <div className="text-sm font-semibold">{body.info.yearLength}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">
            {body.type === "star" ? "Planets" : "Moons"}
          </div>
          <div className="text-sm font-semibold">{body.children.length}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">Gravity</div>
          <div className="text-sm font-semibold">{body.info.gravity} m/s²</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">Tilt</div>
          <div className="text-sm font-semibold">{body.info.axialTilt}°</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">Rings</div>
          <div className="text-sm font-semibold">
            {body.info.rings ? "Yes" : "No"}
          </div>
        </div>
      </div>

      {/* Atmosphere */}
      {body.info.atmosphere.length > 0 && (
        <div>
          <div className="text-[9px] text-[#666] uppercase tracking-wider mb-2">
            Atmosphere
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {body.info.atmosphere.map((comp) => (
              <span
                key={comp}
                className="bg-[#ffffff12] px-2 py-1 rounded text-[11px]"
              >
                {comp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fun fact */}
      <div className="bg-[#ffffff08] border-l-2 border-[#4a90d9] py-2.5 px-3 rounded-r-lg text-xs text-[#aaa] leading-relaxed">
        {body.info.funFact}
      </div>

      {/* Go to button */}
      <button
        className="w-full py-2.5 bg-[#ffffff15] border border-[#ffffff20] rounded-lg text-[13px] uppercase tracking-[2px] cursor-pointer hover:bg-[#ffffff25] transition-colors"
        onClick={() => cameraNav?.setFlyTo(body)}
      >
        Go to {body.name} →
      </button>

      {/* Children list */}
      {body.children.length > 0 && (
        <div>
          <div className="text-[9px] text-[#666] uppercase tracking-wider mb-2">
            {body.type === "star" ? "Planets" : "Moons"}
          </div>
          <div>
            {body.children.map((child, index) => (
              <div
                key={child.id}
                className="py-2 first:border-t border-b border-[#ffffff1e] flex justify-between items-center"
              >
                <span
                  className="uppercase text-sm font-bold cursor-pointer hover:text-[#4a90d9] transition-colors"
                  onClick={() => onSelectChild(index)}
                >
                  {child.name}
                </span>
                <FaEye
                  className="cursor-pointer hover:opacity-70 text-sm"
                  onClick={() => cameraNav?.setFlyTo(child)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cards/CelestialDetail.tsx
git commit -m "feat: create CelestialDetail component with hero, stats, atmosphere, children"
```

---

### Task 6: Create CelestialCard component with navigation and transitions

**Files:**
- Create: `src/lib/cards/CelestialCard.tsx`

- [ ] **Step 1: Create CelestialCard.tsx**

```tsx
import { useState, useRef, useEffect } from "react";
import { MdArrowForwardIos } from "react-icons/md";
import { CelestialBody } from "../../data";
import CelestialDetail from "./CelestialDetail";

interface CelestialCardProps {
  root: CelestialBody;
  visible: boolean;
}

function getBodyAtPath(root: CelestialBody, path: number[]): CelestialBody {
  let current = root;
  for (const index of path) {
    current = current.children[index];
  }
  return current;
}

function getBreadcrumb(
  root: CelestialBody,
  path: number[]
): { name: string; path: number[] }[] {
  const crumbs: { name: string; path: number[] }[] = [
    { name: root.name, path: [] },
  ];
  let current = root;
  for (let i = 0; i < path.length; i++) {
    current = current.children[path[i]];
    crumbs.push({ name: current.name, path: path.slice(0, i + 1) });
  }
  return crumbs;
}

export default function CelestialCard({ root, visible }: CelestialCardProps) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<number[]>([]);
  const [direction, setDirection] = useState<"left" | "right">("left");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayPath, setDisplayPath] = useState<number[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  const body = getBodyAtPath(root, displayPath);
  const breadcrumb = getBreadcrumb(root, displayPath);

  useEffect(() => {
    if (path === displayPath) return;
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setDisplayPath(path);
      setIsTransitioning(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [path]);

  const navigateTo = (newPath: number[]) => {
    if (newPath.length > path.length) {
      setDirection("left");
    } else {
      setDirection("right");
    }
    setPath(newPath);
  };

  const handleSelectChild = (index: number) => {
    navigateTo([...displayPath, index]);
  };

  const slideClass = isTransitioning
    ? direction === "left"
      ? "-translate-x-full opacity-0"
      : "translate-x-full opacity-0"
    : "translate-x-0 opacity-100";

  return (
    <>
      {/* Desktop card */}
      <div
        className={`fixed z-[999999999] sm:block hidden duration-500 top-0 right-0 h-screen ${
          visible && open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full w-[380px] bg-[#0a0a0fdd] bg-blur-custom p-6 overflow-y-auto text-white">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 mb-4 text-xs text-[#666] flex-wrap">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-[#444]">›</span>}
                <span
                  className={`cursor-pointer hover:text-white transition-colors ${
                    i === breadcrumb.length - 1
                      ? "text-white font-semibold"
                      : ""
                  }`}
                  onClick={() => navigateTo(crumb.path)}
                >
                  {crumb.name}
                </span>
              </span>
            ))}
          </div>

          {/* Content with transitions */}
          <div className="overflow-hidden">
            <div
              ref={contentRef}
              className={`transition-all duration-300 ease-in-out ${slideClass}`}
            >
              <CelestialDetail
                body={body}
                onSelectChild={handleSelectChild}
              />
            </div>
          </div>
        </div>

        {/* Toggle button */}
        {visible && (
          <div className="absolute h-full flex items-center left-0 top-0 -translate-x-full text-white">
            <div
              className={`p-2 bg-[#ffffff33] mr-2 duration-150 rounded-full cursor-pointer hover:bg-[#ffffff67] ${
                open ? "rotate-0" : "rotate-180"
              }`}
              onClick={() => setOpen((prev) => !prev)}
            >
              <MdArrowForwardIos />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cards/CelestialCard.tsx
git commit -m "feat: create CelestialCard with hierarchical navigation and slide transitions"
```

---

### Task 7: Create MobileSheet component

**Files:**
- Create: `src/lib/cards/MobileSheet.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Create MobileSheet.tsx**

```tsx
import { useState } from "react";
import { MdMenu, MdClose } from "react-icons/md";
import { CelestialBody } from "../../data";
import CelestialDetail from "./CelestialDetail";

interface MobileSheetProps {
  root: CelestialBody;
  visible: boolean;
}

function getBodyAtPath(root: CelestialBody, path: number[]): CelestialBody {
  let current = root;
  for (const index of path) {
    current = current.children[index];
  }
  return current;
}

function getBreadcrumb(
  root: CelestialBody,
  path: number[]
): { name: string; path: number[] }[] {
  const crumbs: { name: string; path: number[] }[] = [
    { name: root.name, path: [] },
  ];
  let current = root;
  for (let i = 0; i < path.length; i++) {
    current = current.children[path[i]];
    crumbs.push({ name: current.name, path: path.slice(0, i + 1) });
  }
  return crumbs;
}

export default function MobileSheet({ root, visible }: MobileSheetProps) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<number[]>([]);

  const body = getBodyAtPath(root, path);
  const breadcrumb = getBreadcrumb(root, path);

  if (!visible) return null;

  return (
    <>
      {/* Floating button */}
      <button
        className="fixed z-[999999999] sm:hidden bottom-4 right-4 p-3 bg-[#ffffff33] bg-blur-custom rounded-full text-white cursor-pointer hover:bg-[#ffffff67]"
        onClick={() => setOpen(true)}
      >
        <MdMenu size={24} />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[999999999] sm:hidden bg-[#00000080]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed z-[9999999999] sm:hidden bottom-0 left-0 right-0 bg-[#0a0a0fee] bg-blur-custom rounded-t-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "70vh" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-[#ffffff30] rounded-full" />
        </div>

        {/* Close button */}
        <button
          className="absolute top-3 right-4 text-white opacity-60 hover:opacity-100"
          onClick={() => setOpen(false)}
        >
          <MdClose size={20} />
        </button>

        {/* Content */}
        <div className="px-5 pb-6 overflow-y-auto text-white" style={{ height: "calc(70vh - 48px)" }}>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 mb-4 text-xs text-[#666] flex-wrap">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-[#444]">›</span>}
                <span
                  className={`cursor-pointer ${
                    i === breadcrumb.length - 1
                      ? "text-white font-semibold"
                      : ""
                  }`}
                  onClick={() => setPath(crumb.path)}
                >
                  {crumb.name}
                </span>
              </span>
            ))}
          </div>

          <CelestialDetail
            body={body}
            onSelectChild={(index) => setPath([...path, index])}
          />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cards/MobileSheet.tsx
git commit -m "feat: create MobileSheet bottom sheet component for mobile navigation"
```

---

### Task 8: Wire into App, delete old Card, final cleanup

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/lib/cards/Card.tsx`

- [ ] **Step 1: Update App.tsx**

Replace the imports in `src/App.tsx`. Remove:

```tsx
import { StarParam } from "./data";
import Card from "./lib/cards/Card";
```

Add:

```tsx
import { SOLAR_SYSTEM } from "./data";
import CelestialCard from "./lib/cards/CelestialCard";
import MobileSheet from "./lib/cards/MobileSheet";
```

Replace the info state:

```tsx
  const [info] = useState<StarParam | null>(CELESTIAL_BODIES[0] ?? null);
```

With (just remove it — we pass `SOLAR_SYSTEM` directly now).

Replace the Card usage in JSX:

```tsx
      <Card visible={visible} info={info} />
```

With:

```tsx
      <CelestialCard root={SOLAR_SYSTEM} visible={visible} />
      <MobileSheet root={SOLAR_SYSTEM} visible={visible} />
```

Also remove the now-unused `StarParam` import if it was the only thing from that import line. The `CELESTIAL_BODIES` import is still needed by the `stars` map. Keep it.

Remove the `useState` import for `StarParam`-related state. The final imports should be:

```tsx
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { OrbitControls } from "@react-three/drei";
import { useState, useContext, useRef } from "react";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import CameraFly from "./lib/camera/CameraFly";
import { CELESTIAL_BODIES, SOLAR_SYSTEM } from "./data";
import { ScaleEarthUnitSize } from "./helper/units";
import StarField from "./lib/starfield/Starfield";
import Star from "./lib/stars/Star";
import CelestialCard from "./lib/cards/CelestialCard";
import MobileSheet from "./lib/cards/MobileSheet";
import { ScaleDistanceScaleContext } from "./context/contexts";
```

The `App` function body should have `visible` and `setVisible` state (still used by Star), the `controlsRef`, and the `stars` map. No more `info` state.

- [ ] **Step 2: Delete old Card.tsx**

```bash
rm src/lib/cards/Card.tsx
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 4: Manual test in browser**

Open `http://localhost:5317`. Steps:
1. Desktop: click the arrow toggle on the right → card opens with Sun detail + planet list
2. Click "Earth" name → slides to Earth detail with Moon listed
3. Click breadcrumb "Sun" → slides back to Sun
4. Click eye icon next to Mars → camera flies to Mars
5. Click "Go to Jupiter" button → camera flies to Jupiter
6. Resize browser to mobile width → card disappears, floating menu button appears
7. Tap menu button → bottom sheet slides up with same content
8. Navigate inside bottom sheet → breadcrumb works
9. Tap overlay → sheet closes

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire CelestialCard and MobileSheet into App, remove old Card"
```
