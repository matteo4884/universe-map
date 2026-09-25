/**
 * Two-body propagation of Keplerian elements (ecliptic J2000, km).
 * Elements come from JPL Horizons via scripts/fetch-ephemeris.mjs.
 */

export type Vec3 = [number, number, number];

export interface OrbitalElements {
  epoch: number; // ms since Unix epoch (UTC)
  a: number; // semi-major axis, km
  e: number; // eccentricity (< 1)
  i: number; // inclination, deg
  om: number; // longitude of ascending node, deg
  w: number; // argument of periapsis, deg
  ma: number; // mean anomaly at epoch, deg
  n: number; // mean motion, deg/day
}

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
export const DAY_MS = 86400000;

/** Eccentric anomaly E from mean anomaly M (rad) — Newton iteration on E − e·sinE = M */
export function solveKepler(meanAnomaly: number, e: number): number {
  const M = ((meanAnomaly % TWO_PI) + TWO_PI) % TWO_PI;
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 50; k++) {
    const step = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return E;
}

/** Rotate a point from the orbital plane (periapsis along +x) to the ecliptic frame */
function toEcliptic(el: OrbitalElements, xp: number, yp: number): Vec3 {
  const cO = Math.cos(el.om * DEG), sO = Math.sin(el.om * DEG);
  const cw = Math.cos(el.w * DEG), sw = Math.sin(el.w * DEG);
  const ci = Math.cos(el.i * DEG), si = Math.sin(el.i * DEG);
  return [
    (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

function pointAtEccentricAnomaly(el: OrbitalElements, E: number): Vec3 {
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  return toEcliptic(el, xp, yp);
}

/** Position (km) relative to the orbit's center at time `t` (ms) */
export function keplerPosition(el: OrbitalElements, t: number): Vec3 {
  const days = (t - el.epoch) / DAY_MS;
  const M = (el.ma + el.n * days) * DEG;
  return pointAtEccentricAnomaly(el, solveKepler(M, el.e));
}

/** Closed ellipse (km) sampled evenly in eccentric anomaly */
export function orbitPath(el: OrbitalElements, segments: number): Vec3[] {
  const points: Vec3[] = [];
  for (let k = 0; k <= segments; k++) {
    points.push(pointAtEccentricAnomaly(el, (k / segments) * TWO_PI));
  }
  return points;
}

/** Orbital period in days */
export function orbitalPeriodDays(el: OrbitalElements): number {
  return 360 / Math.abs(el.n);
}
