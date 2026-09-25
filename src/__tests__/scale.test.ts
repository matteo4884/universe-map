import { describe, expect, test } from "vitest";
import orbits from "./fixtures/orbits.json";
import { createEphemeris } from "../helper/ephemeris";
import { logScaleRadius, blendRadius } from "../helper/units";
import { moonOffset } from "../helper/bodyPosition";
import { ALL_BODIES, getParent } from "../helper/bodies";
import { DAY_MS } from "../helper/kepler";
import type { OrbitsData } from "../services/orbits";

const eph = createEphemeris(orbits as unknown as OrbitsData);
const epoch = new Date((orbits as unknown as OrbitsData).fetchedAt).getTime();

describe("log-mode radius", () => {
  test("is monotonic: a bigger body is never drawn smaller", () => {
    const sorted = ALL_BODIES.filter((b) => b.type !== "galaxy").sort((a, b) => a.radius - b.radius);
    for (let i = 1; i < sorted.length; i++) {
      expect(logScaleRadius(sorted[i].radius)).toBeGreaterThanOrEqual(logScaleRadius(sorted[i - 1].radius));
    }
  });

  test("giant planets keep their order", () => {
    const r = (name: string) => logScaleRadius(ALL_BODIES.find((b) => b.name === name)!.radius);
    expect(r("Jupiter")).toBeGreaterThan(r("Saturn"));
    expect(r("Saturn")).toBeGreaterThan(r("Uranus"));
    expect(r("Uranus")).toBeGreaterThanOrEqual(r("Neptune"));
  });

  test("realistic mode is the true size", () => {
    expect(blendRadius(6371, 1)).toBeCloseTo(1, 10);
  });
});

describe("moons in log mode", () => {
  const satellites = ALL_BODIES.filter((b) => b.type === "moon" || (b.type === "spacecraft" && getParent(b)?.type === "planet"));

  for (const moon of satellites) {
    test(`${moon.name} is always outside its planet`, () => {
      const planet = getParent(moon)!;
      const planetRadius = logScaleRadius(planet.radius);
      for (let k = 0; k < 50; k++) {
        const t = epoch + (k - 25) * 7.3 * DAY_MS;
        const [x, y, z] = moonOffset(moon, planet, eph.relative(moon, t), 0);
        expect(Math.hypot(x, y, z) - blendRadius(moon.radius, 0)).toBeGreaterThan(planetRadius);
      }
    });
  }
});
