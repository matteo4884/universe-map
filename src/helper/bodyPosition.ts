import { CelestialBody } from "../data";
import { EphemerisData } from "../services/horizons";
import {
  blendPosition,
  blendMoonPosition,
  blendRadius,
  logScaleRadius,
  KM_PER_UNIT,
} from "./units";

// Saturn's ring extent, in planet radii
export const SATURN_RING_INNER = 1.28;
export const SATURN_RING_OUTER = 2.41;

export function hasRenderedRings(planet: CelestialBody): boolean {
  return planet.map === "saturn";
}

/** Where moons start in log mode: the planet's surface, or its ring edge */
function moonBaseUnits(planet: CelestialBody): number {
  const radius = logScaleRadius(planet.radius);
  return hasRenderedRings(planet) ? radius * SATURN_RING_OUTER : radius;
}

/** Planet position relative to its star, in scene units */
export function planetPosition(
  planet: CelestialBody,
  star: CelestialBody,
  positions: EphemerisData | null,
  blend: number
): [number, number, number] {
  const pos = positions?.[planet.horizonsId];
  if (pos) return blendPosition(pos.x, pos.y, pos.z, blend);
  const fallbackZ =
    planet.distanceFromParent / KM_PER_UNIT + blendRadius(star.radius, blend);
  return [0, 0, fallbackZ];
}

/** Moon position relative to its planet, in scene units */
export function moonOffset(
  moon: CelestialBody,
  planet: CelestialBody,
  positions: EphemerisData | null,
  blend: number
): [number, number, number] {
  const moonPos = positions?.[moon.horizonsId];
  const planetPos = positions?.[planet.horizonsId];
  if (moonPos && planetPos) {
    return blendMoonPosition(
      moonPos.x - planetPos.x,
      moonPos.y - planetPos.y,
      moonPos.z - planetPos.z,
      blend,
      moonBaseUnits(planet)
    );
  }
  const offset =
    moon.distanceFromParent / KM_PER_UNIT + blendRadius(planet.radius, blend);
  return [offset, offset, 0];
}
