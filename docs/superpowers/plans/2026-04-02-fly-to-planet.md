# Fly-to-Planet Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add eye icon buttons to the planet card that trigger smooth camera fly animations to each planet.

**Architecture:** New `CameraNavigationContext` communicates fly-to targets from the HTML Card (outside Canvas) to a `CameraFly` component (inside Canvas) that animates camera position and OrbitControls target using lerp in `useFrame`.

**Tech Stack:** React, Three.js, React Three Fiber, @react-three/drei (OrbitControls), react-icons (FaEye)

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/context/cameraNavigation.tsx` | Create | Context + Provider for `flyTo` state |
| `src/lib/camera/CameraFly.tsx` | Create | Animation component: reads flyTo, animates camera, manages minDistance |
| `src/lib/cards/Card.tsx` | Modify | Add FaEye icon per planet row, call setFlyTo on click |
| `src/App.tsx` | Modify | Add CameraNavigationProvider, CameraFly component, OrbitControls ref |
| `src/main.tsx` | Modify | Wrap App with CameraNavigationProvider |

---

### Task 1: Create CameraNavigation context

**Files:**
- Create: `src/context/cameraNavigation.tsx`

- [ ] **Step 1: Create the context and provider**

```tsx
import { createContext, useState } from "react";
import { PlanetParam } from "../data";

export type CameraNavigationContextType = {
  flyTo: PlanetParam | null;
  setFlyTo: (planet: PlanetParam | null) => void;
};

export const CameraNavigationContext = createContext<
  CameraNavigationContextType | undefined
>(undefined);

export function CameraNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flyTo, setFlyTo] = useState<PlanetParam | null>(null);

  return (
    <CameraNavigationContext.Provider value={{ flyTo, setFlyTo }}>
      {children}
    </CameraNavigationContext.Provider>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/context/cameraNavigation.tsx
git commit -m "feat: add CameraNavigation context for fly-to-planet state"
```

---

### Task 2: Add eye icon to Card planet rows

**Files:**
- Modify: `src/lib/cards/Card.tsx`

- [ ] **Step 1: Update Card imports and props**

Add imports and update the `CardParam` interface to accept `setFlyTo`. The Card needs access to `PlanetParam` to pass to setFlyTo.

In `src/lib/cards/Card.tsx`, replace the imports and interface:

```tsx
import { useState, useContext } from "react";
import { StarParam } from "../../data";
import { MdArrowForwardIos } from "react-icons/md";
import { FaEye } from "react-icons/fa";
import { CameraNavigationContext } from "../../context/cameraNavigation";
```

- [ ] **Step 2: Add eye icon and click handler to each planet row**

Replace the planet map inside the Card component. Find this block:

```tsx
{info?.planets.map((planet) => {
  return (
    <div
      key={planet.name}
      className="py-1 first:border-t border-b border-[#ffffff1e] flex justify-between"
    >
      <b className="uppercase text-[20px]">{planet.name}</b>
      {/* <FaEye /> */}
    </div>
  );
})}
```

Replace with:

```tsx
{info?.planets.map((planet) => {
  return (
    <div
      key={planet.name}
      className="py-1 first:border-t border-b border-[#ffffff1e] flex justify-between items-center"
    >
      <b className="uppercase text-[20px]">{planet.name}</b>
      <FaEye
        className="cursor-pointer hover:opacity-70"
        onClick={() => {
          cameraNav?.setFlyTo(planet);
        }}
      />
    </div>
  );
})}
```

- [ ] **Step 3: Add context consumption at the top of the Card component**

Inside the `Card` function body, before the existing `useState`, add:

```tsx
const cameraNav = useContext(CameraNavigationContext);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/cards/Card.tsx
git commit -m "feat: add FaEye icon to planet rows in Card with fly-to click"
```

---

### Task 3: Create CameraFly animation component

**Files:**
- Create: `src/lib/camera/CameraFly.tsx`

- [ ] **Step 1: Create the CameraFly component**

```tsx
import { useContext, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CameraNavigationContext } from "../../context/cameraNavigation";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { ScaleDistance, ScaleEarthUnitSize } from "../../helper/units";
import { CELESTIAL_BODIES } from "../../data";
import { PlanetParam } from "../../data";

interface CameraFlyProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

function computePlanetPosition(planet: PlanetParam, scaleDistance: number): THREE.Vector3 {
  const star = CELESTIAL_BODIES[0];
  const x = ScaleDistance({ distance: 0, scale: scaleDistance });
  const y = ScaleDistance({ distance: 0, scale: scaleDistance });
  const z =
    ScaleDistance({ distance: planet.distanceFromStar, scale: scaleDistance }) +
    ScaleEarthUnitSize({ size: star.radius }) +
    ScaleEarthUnitSize({ size: planet.radius });
  return new THREE.Vector3(x, y, z);
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
  const currentPlanetRadius = useRef(0);
  const currentPlanetPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!cameraNav || !contextScaleDistance) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const { flyTo, setFlyTo } = cameraNav;
    const { scaleDistance } = contextScaleDistance;

    // Start a new fly-to animation
    if (flyTo && !isAnimating.current) {
      const planetPos = computePlanetPosition(flyTo, scaleDistance);
      const planetRadius = ScaleEarthUnitSize({ size: flyTo.radius });

      // Camera landing position: radius * 3 away, offset up by radius * 1.5
      const cameraTarget = new THREE.Vector3(
        planetPos.x,
        planetPos.y + planetRadius * 1.5,
        planetPos.z + planetRadius * 3
      );

      // Calculate animation duration proportional to distance (0.8s - 3s)
      const dist = camera.position.distanceTo(cameraTarget);
      const maxDist = 500000; // approximate max scene distance
      const t = Math.min(dist / maxDist, 1);
      animationDuration.current = 0.8 + t * 2.2;

      // Store start/end state
      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      endPosition.current.copy(cameraTarget);
      endTarget.current.copy(planetPos);
      currentPlanetRadius.current = planetRadius;
      currentPlanetPos.current.copy(planetPos);

      // Begin animation
      animationProgress.current = 0;
      isAnimating.current = true;
      controls.enabled = false;

      // Clear flyTo so clicking the same planet again works
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
        controls.minDistance = currentPlanetRadius.current * 1.5;
        controls.update();
      }
    }

    // minDistance reset: when far enough from planet, remove the constraint
    if (
      !isAnimating.current &&
      currentPlanetRadius.current > 0
    ) {
      const distToPlanet = camera.position.distanceTo(currentPlanetPos.current);
      if (distToPlanet > currentPlanetRadius.current * 20) {
        controls.minDistance = 0;
        currentPlanetRadius.current = 0;
      }
    }
  });

  return null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/camera/CameraFly.tsx
git commit -m "feat: add CameraFly component with smooth lerp animation and minDistance management"
```

---

### Task 4: Wire everything together in App and main

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Update App.tsx imports**

Add to the existing imports in `src/App.tsx`:

```tsx
import { useRef } from "react";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import CameraFly from "./lib/camera/CameraFly";
```

Update the existing import to include `useRef`:

```tsx
import { useState, useContext, useRef } from "react";
```

- [ ] **Step 2: Add OrbitControls ref and CameraFly inside Canvas**

In `src/App.tsx`, inside the `App` function, add the ref:

```tsx
const controlsRef = useRef<OrbitControlsImpl>(null);
```

Replace the OrbitControls JSX:

```tsx
<OrbitControls
  target={[-100, 0, 550]}
  rotateSpeed={0.6}
  panSpeed={0.6}
  zoomSpeed={1.5}
  maxDistance={3000000000}
  // minDistance={1.5}
/>
```

With:

```tsx
<OrbitControls
  ref={controlsRef}
  target={[-100, 0, 550]}
  rotateSpeed={0.6}
  panSpeed={0.6}
  zoomSpeed={1.5}
  maxDistance={3000000000}
/>
<CameraFly controlsRef={controlsRef} />
```

- [ ] **Step 3: Wrap with CameraNavigationProvider in main.tsx**

In `src/main.tsx`, add import:

```tsx
import { CameraNavigationProvider } from "./context/cameraNavigation.tsx";
```

Update the render tree:

```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScaleDistanceScaleProvider>
      <CameraNavigationProvider>
        <App />
      </CameraNavigationProvider>
    </ScaleDistanceScaleProvider>
  </StrictMode>
);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Manual test in browser**

Open `http://localhost:5317`. Steps:
1. Open the side card (click the arrow button)
2. Click the eye icon next to "Earth"
3. Verify: camera smoothly flies to Earth over ~1-2 seconds
4. Verify: OrbitControls center on Earth, can rotate around it
5. Verify: cannot zoom inside Earth (minDistance active)
6. Zoom far out from Earth → verify minDistance resets (can zoom freely)
7. Click eye icon next to "Neptune" → verify longer animation duration
8. Click eye icon next to "Mercury" → verify shorter animation duration

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: wire CameraFly and CameraNavigationProvider into app"
```
