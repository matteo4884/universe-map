# Fly-to-Planet Navigation

## Problem

Navigation in the 3D universe map is difficult. Distances between planets are enormous, and zooming with the mouse becomes impractical at scale. Users need a direct way to jump to any planet.

## Solution

Add an eye icon button next to each planet name in the existing side card. Clicking it triggers a smooth camera flight animation to the selected planet.

## UI

- Eye icon (FaEye from react-icons) placed inline at the right of each planet row in the Card component
- Always visible, white, small (same size as planet name text)
- Click triggers the fly-to animation

## Camera Animation

### Method
Manual lerp in `useFrame` (no external libraries). Interpolate both `camera.position` and `controls.target` simultaneously with ease-out.

### Duration
Proportional to distance between current camera position and target planet:
- Minimum: 0.8 seconds (nearby planets)
- Maximum: 3 seconds (distant planets like Neptune)
- Linear interpolation between min/max based on distance, clamped

### Landing Position
- Camera positioned at `planetRadius * 3` distance from the planet center
- Y offset of `planetRadius * 1.5` for a slightly elevated view
- OrbitControls target set to the planet center

### OrbitControls During Animation
- Disabled (`controls.enabled = false`) while animating to prevent user input conflicts
- Re-enabled on animation completion

## Post-Landing Behavior

### OrbitControls Configuration
- `target`: planet center position
- `minDistance`: `planetRadius * 1.5` (prevents entering the planet mesh)
- `maxDistance`: unchanged (global value of 3,000,000,000)

### minDistance Reset
- Monitored in `useFrame`: when camera distance from the current planet exceeds `planetRadius * 20`, `minDistance` resets to default (0)
- This allows free navigation when zoomed out far enough from the planet
- When flying to a new planet, the new planet's `minDistance` overwrites the previous one automatically

### Return to Global View
- No back button. User zooms out manually with mouse or clicks another planet from the card
- OrbitControls remain fully functional after landing

## Architecture

### New Files
1. **`src/context/cameraNavigation.tsx`** — Context + Provider
   - `flyTo: PlanetParam | null` — target planet (null = no animation)
   - `setFlyTo: (planet: PlanetParam | null) => void`

2. **`src/lib/camera/CameraFly.tsx`** — Animation component (inside Canvas)
   - Reads `flyTo` from context
   - Computes target position using `ScaleDistance` and `ScaleEarthUnitSize` (same functions used by `Star.tsx`)
   - Animates in `useFrame` with lerp + easing
   - Needs ref to OrbitControls (passed as prop)
   - Manages `minDistance` lifecycle

### Modified Files
1. **`src/App.tsx`**
   - Wrap with `CameraNavigationProvider`
   - Add `<CameraFly />` inside Canvas
   - Add `ref` to `<OrbitControls>` and pass to `CameraFly`

2. **`src/lib/cards/Card.tsx`**
   - Import `FaEye` from react-icons
   - Add eye icon to each planet row
   - On click: call `setFlyTo(planet)` from context

### Position Calculation
`CameraFly` must compute the same world position as `Star.tsx` does for each planet:
```
x: ScaleDistance({ distance: 0, scale: scaleDistance })
y: ScaleDistance({ distance: 0, scale: scaleDistance })
z: ScaleDistance({ distance: planet.distanceFromStar, scale: scaleDistance })
   + ScaleEarthUnitSize({ size: star.radius })
   + ScaleEarthUnitSize({ size: planet.radius })
```
Uses `CELESTIAL_BODIES[0]` as the star reference (Sun).

## Dependencies
None. Uses only Three.js + React Three Fiber already in the project.
