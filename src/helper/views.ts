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

/** Overview camera offset from the Sun */
export function homeOffset(blend: number, aspect: number): [number, number, number] {
  const d = systemViewDistance(blend, aspect);
  return [0, d * Math.sin(HOME_ELEVATION), d * Math.cos(HOME_ELEVATION)];
}
