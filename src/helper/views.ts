import { blendPosition } from "./units";

// Neptune's semi-major axis — outermost planet, defines system extent
const NEPTUNE_DIST_KM = 4495000000;
const HOME_ELEVATION = Math.PI / 4; // midway between top and front view

/**
 * Camera distance that frames the planets. Narrow (portrait) screens see less
 * horizontally, so they back off to keep the whole system in view.
 */
export function systemViewDistance(blend: number, aspect: number): number {
  const [nx] = blendPosition(NEPTUNE_DIST_KM, 0, 0, blend);
  const fit = aspect < 1.2 ? 1.2 / aspect : 1;
  return Math.abs(nx) * 1.4 * fit;
}

/** Neptune's orbit radius in scene units at this scale: how big the planetary system is */
export function systemRadius(blend: number): number {
  return Math.abs(blendPosition(NEPTUNE_DIST_KM, 0, 0, blend)[0]);
}

/** Overview camera offset from the Sun */
export function homeOffset(blend: number, aspect: number): [number, number, number] {
  const d = systemViewDistance(blend, aspect);
  return [0, d * Math.sin(HOME_ELEVATION), d * Math.cos(HOME_ELEVATION)];
}

// Room around Neptune's orbit (Pluto strays beyond it)
const FIT_MARGIN = 1.15;
// The side view sits a little above the planets' plane: seen exactly edge-on
// the orbits fade away and the planets pile up on one line
const SIDE_ELEVATION = (12 * Math.PI) / 180;

/**
 * Camera offset from the Sun for the top and side views, far enough that
 * Neptune's whole orbit is in frame: from above it's a circle (fits the
 * shorter side of the screen), from the side a thin ellipse (fits the width)
 */
export function systemViewOffset(
  view: "top" | "side",
  blend: number,
  aspect: number,
  fovDeg: number
): [number, number, number] {
  const r = systemRadius(blend) * FIT_MARGIN;
  const halfHeight = Math.tan((fovDeg * Math.PI) / 360);
  if (view === "top") {
    const d = r / (halfHeight * Math.min(1, aspect));
    // Nudged off the pole so "up" stays defined
    return [0, -d * 0.001, d];
  }
  const d = Math.max(r / (halfHeight * aspect), (r * Math.sin(SIDE_ELEVATION)) / halfHeight);
  return [0, d * Math.cos(SIDE_ELEVATION), d * Math.sin(SIDE_ELEVATION)];
}
