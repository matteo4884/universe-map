import { describe, expect, test } from "vitest";
import orbits from "./fixtures/orbits.json";
import reference from "./fixtures/horizons-vectors.json";
import { createEphemeris } from "../helper/ephemeris";
import { solveKepler, keplerPosition, orbitalPeriodDays, DAY_MS, OrbitalElements } from "../helper/kepler";
import { ALL_BODIES } from "../helper/bodies";
import type { OrbitsData } from "../services/orbits";

// Fixtures: orbits.json as fetched by scripts/fetch-ephemeris.mjs, and JPL Horizons
// state vectors around its epoch (scripts/fetch-test-fixture.mjs)
const eph = createEphemeris(orbits as unknown as OrbitsData);
const epoch = new Date(reference.epoch).getTime();

function angleDeg(a: number[], b: number[]): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cos = dot / (Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]));
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
}

// Max angular error (deg, seen from the orbit's center) within 1 year / 5 years of the epoch
const TOLERANCE: Record<string, [number, number]> = {
  Mercury: [0.01, 0.05],
  Earth: [0.01, 0.05],
  Jupiter: [0.01, 0.05],
  Pluto: [0.01, 0.1],
  Ceres: [0.05, 0.5],
  Moon: [0.25, 0.25], // analytic lunar theory beyond a day
  Io: [1, 1],
  Titan: [0.1, 0.2],
  Triton: [1, 3],
  Charon: [0.01, 0.01],
  Mimas: [4, 25], // Mimas–Tethys resonance: not a two-body orbit
  "Voyager 1": [0.001, 0.001],
  JWST: [0.01, 0.01],
};

describe("ephemeris vs JPL Horizons", () => {
  for (const sample of reference.samples) {
    const days = (sample.t - epoch) / DAY_MS;
    test(`${sample.label} at ${days.toFixed(1)} days`, () => {
      const body = ALL_BODIES.find((b) => b.horizonsId === sample.id)!;
      const pos = eph.relative(body, sample.t);
      expect(pos).not.toBeNull();
      const [nearTol, farTol] = TOLERANCE[sample.label];
      const tolerance = Math.abs(days) <= 366 ? nearTol : farTol;
      expect(angleDeg(pos!, sample.pos)).toBeLessThan(tolerance);
    });
  }
});

describe("kepler", () => {
  test("solves Kepler's equation", () => {
    for (const e of [0, 0.1, 0.5, 0.9]) {
      for (const M of [0.1, 1, 2, 3, 5]) {
        const E = solveKepler(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 10);
      }
    }
  });

  test("circular orbit keeps its radius and returns after one period", () => {
    const el: OrbitalElements = { epoch: 0, a: 1000, e: 0, i: 30, om: 40, w: 50, ma: 0, n: 10 };
    const start = keplerPosition(el, 0);
    const later = keplerPosition(el, 7.3 * DAY_MS);
    expect(Math.hypot(...later)).toBeCloseTo(1000, 6);
    const back = keplerPosition(el, orbitalPeriodDays(el) * DAY_MS);
    back.forEach((v, i) => expect(v).toBeCloseTo(start[i], 6));
  });
});

describe("spacecraft", () => {
  const voyager = ALL_BODIES.find((b) => b.map === "voyager-1")!;
  test("don't exist before launch", () => {
    expect(eph.relative(voyager, Date.UTC(1970, 0, 1))).toBeNull();
  });
  test("keep moving past the end of the sampled data", () => {
    const traj = eph.trajectory(voyager)!;
    const end = traj.start + (traj.points.length - 1) * traj.stepDays * DAY_MS;
    const a = eph.relative(voyager, end)!;
    const b = eph.relative(voyager, end + 365 * DAY_MS)!;
    expect(Math.hypot(...b)).toBeGreaterThan(Math.hypot(...a));
  });
});

describe("every body has data", () => {
  for (const body of ALL_BODIES.filter((b) => b.type !== "galaxy" && b.type !== "region")) {
    test(body.name, () => {
      expect(eph.relative(body, epoch)).not.toBeNull();
    });
  }
});
