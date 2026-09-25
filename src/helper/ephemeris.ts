import { CelestialBody } from "../data";
import { OrbitsData, Trajectory } from "../services/orbits";
import { keplerPosition, orbitPath, OrbitalElements, Vec3, DAY_MS } from "./kepler";
import { moonPositionAnalytic } from "./moonTheory";
import { getParent } from "./bodies";

/**
 * Positions of every body at any instant, from the orbital data in orbits.json.
 * All positions are km in ecliptic J2000.
 */
export interface Ephemeris {
  fetchedAt: string;
  /** Position relative to the body's parent (the Sun for planets), or null when unknown at `t` */
  relative(body: CelestialBody, t: number): Vec3 | null;
  /** Position relative to the Sun */
  heliocentric(body: CelestialBody, t: number): Vec3 | null;
  /** Closed orbit ellipse relative to the parent, for bodies on Keplerian orbits */
  orbit(body: CelestialBody, segments: number): Vec3[] | null;
  /** Sampled path, for spacecraft */
  trajectory(body: CelestialBody): Trajectory | null;
}

/** Cubic (Catmull-Rom) interpolation through the samples; null before the first one */
export function sampleTrajectory(traj: Trajectory, t: number, extrapolate: boolean): Vec3 | null {
  const pts = traj.points;
  const f = (t - traj.start) / (traj.stepDays * DAY_MS);
  if (f < 0 || pts.length === 0) return null;
  const last = pts.length - 1;
  if (f >= last) {
    if (!extrapolate || last === 0) return [...pts[last]];
    // Beyond the data: keep going at the last known velocity
    const k = f - last;
    const a = pts[last - 1], b = pts[last];
    return [b[0] + (b[0] - a[0]) * k, b[1] + (b[1] - a[1]) * k, b[2] + (b[2] - a[2]) * k];
  }
  const i = Math.floor(f);
  const u = f - i;
  const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, last)];
  const u2 = u * u, u3 = u2 * u;
  const out: Vec3 = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    out[c] = 0.5 * (
      2 * p1[c] +
      (p2[c] - p0[c]) * u +
      (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 +
      (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * u3
    );
  }
  return out;
}

// The Moon: Keplerian elements are exact near their epoch, the analytic theory
// is better beyond a day (the Sun's pull makes the orbit drift). Blend between.
const MOON_ID = "301";
const MOON_KEPLER_DAYS = 1;
const MOON_BLEND_DAYS = 2;

function moonPosition(el: OrbitalElements, t: number): Vec3 {
  const days = Math.abs(t - el.epoch) / DAY_MS;
  if (days <= MOON_KEPLER_DAYS) return keplerPosition(el, t);
  const analytic = moonPositionAnalytic(t);
  if (days >= MOON_KEPLER_DAYS + MOON_BLEND_DAYS) return analytic;
  const k = (days - MOON_KEPLER_DAYS) / MOON_BLEND_DAYS;
  const kep = keplerPosition(el, t);
  return [
    kep[0] + (analytic[0] - kep[0]) * k,
    kep[1] + (analytic[1] - kep[1]) * k,
    kep[2] + (analytic[2] - kep[2]) * k,
  ];
}

export function createEphemeris(data: OrbitsData): Ephemeris {
  const { elements, trajectories } = data;

  function elementPosition(id: string, t: number): Vec3 | null {
    const el = elements[id];
    if (!el) return null;
    return id === MOON_ID ? moonPosition(el, t) : keplerPosition(el, t);
  }

  function relative(body: CelestialBody, t: number): Vec3 | null {
    if (body.type === "star" || body.type === "galaxy") return [0, 0, 0];

    if (body.type === "spacecraft") {
      const traj = trajectories[body.horizonsId];
      if (!traj) return null;
      // Sun-centered paths keep drifting outward; Earth-bound ones (JWST) hold position
      return sampleTrajectory(traj, t, getParent(body)?.type === "star");
    }

    const pos = elementPosition(body.orbitId ?? body.horizonsId, t);
    if (!pos) return null;

    // The orbit is the barycenter's: the body sits opposite its big moon
    if (body.barycenter) {
      const s = elementPosition(body.barycenter.satelliteId, t);
      if (s) {
        const q = body.barycenter.massRatio;
        pos[0] -= s[0] * q;
        pos[1] -= s[1] * q;
        pos[2] -= s[2] * q;
      }
    }
    return pos;
  }

  function heliocentric(body: CelestialBody, t: number): Vec3 | null {
    const rel = relative(body, t);
    if (!rel) return null;
    const parent = getParent(body);
    if (!parent || parent.type === "star" || parent.type === "galaxy") return rel;
    const p = heliocentric(parent, t);
    if (!p) return null;
    return [p[0] + rel[0], p[1] + rel[1], p[2] + rel[2]];
  }

  function orbit(body: CelestialBody, segments: number): Vec3[] | null {
    if (body.type === "spacecraft") return null;
    const el = elements[body.orbitId ?? body.horizonsId];
    return el ? orbitPath(el, segments) : null;
  }

  function trajectory(body: CelestialBody): Trajectory | null {
    return body.type === "spacecraft" ? trajectories[body.horizonsId] ?? null : null;
  }

  return { fetchedAt: data.fetchedAt, relative, heliocentric, orbit, trajectory };
}
