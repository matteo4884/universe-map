import { CelestialBody } from "../data";
import { Ephemeris } from "./ephemeris";
import { Vec3 } from "./kepler";
import { getParent } from "./bodies";
import { blendPosition, blendMoonPosition, logScaleRadius } from "./units";

const AU_KM = 149597870.7;

// Saturn's ring extent, in planet radii
export const SATURN_RING_INNER = 1.28;
export const SATURN_RING_OUTER = 2.41;

export function hasRenderedRings(planet: CelestialBody): boolean {
  return planet.map === "saturn";
}

/** Bodies placed relative to a planet (moons, Earth-bound spacecraft) rather than the Sun */
export function orbitsPlanet(body: CelestialBody): boolean {
  const parent = getParent(body);
  return !!parent && parent.type === "planet";
}

/** Where moons start in log mode: the planet's surface, or its ring edge */
function moonBaseUnits(planet: CelestialBody): number {
  const radius = logScaleRadius(planet.radius);
  return hasRenderedRings(planet) ? radius * SATURN_RING_OUTER : radius;
}

/** Scene offset (units) of a moon from its planet, from its planet-relative position (km) */
export function moonOffset(
  moon: CelestialBody,
  planet: CelestialBody,
  rel: Vec3 | null,
  blend: number
): Vec3 {
  // Without orbital data: its mean distance along +x, scaled like every other moon
  const [x, y, z] = rel ?? [moon.distanceFromParent, 0, 0];
  return blendMoonPosition(x, y, z, blend, moonBaseUnits(planet));
}

/** Scene position (units) of a Sun-orbiting body, from its heliocentric position (km) */
export function sunOrbitPosition(body: CelestialBody, helio: Vec3 | null, blend: number): Vec3 {
  // Without orbital data: its mean distance along +x, scaled like every other body
  const [x, y, z] = helio ?? [body.distanceFromParent, 0, 0];
  return blendPosition(x, y, z, blend);
}

/**
 * World position (scene units) of any body at time `t` and scale `blend`,
 * or null when the body doesn't exist at `t` (spacecraft before launch).
 * The Sun sits at the origin.
 */
export function scenePosition(
  body: CelestialBody,
  eph: Ephemeris | null,
  t: number,
  blend: number
): Vec3 | null {
  if (body.type === "star" || body.type === "galaxy") return [0, 0, 0];
  const parent = getParent(body);
  if (!parent) return [0, 0, 0];

  const rel = eph ? eph.relative(body, t) : null;
  if (!rel && body.type === "spacecraft") return null;

  if (parent.type === "star") return sunOrbitPosition(body, rel, blend);

  const parentPos = scenePosition(parent, eph, t, blend);
  if (!parentPos) return null;
  const offset = moonOffset(body, parent, rel, blend);
  return [parentPos[0] + offset[0], parentPos[1] + offset[1], parentPos[2] + offset[2]];
}

/** A region's (asteroid belt's) mean radius and outer edge, in km */
export function regionRadiiKm(region: CelestialBody): { mid: number; outer: number } {
  const r = region.region!;
  return { mid: ((r.innerAU + r.outerAU) / 2) * AU_KM, outer: r.outerAU * AU_KM };
}

// Turned away from the exact near point, where planet labels tend to sit
const REGION_LABEL_TURN = (40 * Math.PI) / 180;

/**
 * Point on a region's ring on the side facing `viewer` (scene units), so its
 * label sits on the visible near edge rather than behind the Sun
 */
export function regionAnchor(region: CelestialBody, viewer: Vec3, blend: number): Vec3 {
  const { mid } = regionRadiiKm(region);
  const len = Math.hypot(viewer[0], viewer[1]);
  const angle = (len > 1e-9 ? Math.atan2(viewer[1], viewer[0]) : -Math.PI / 2) + REGION_LABEL_TURN;
  return blendPosition(Math.cos(angle) * mid, Math.sin(angle) * mid, 0, blend);
}
