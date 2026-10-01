import { describe, expect, test } from "vitest";
import { CLOUD_BLOBS, CLOUD_MAX_TAU, CLOUD_REACH_KPC, DARK_CLOUDS, cloudDepth, fromSun } from "../helper/darkClouds";
import { SUN_DISTANCE_KPC } from "../helper/galaxy";

const SUN: [number, number, number] = [0, -SUN_DISTANCE_KPC, 0];

/** Mean visual extinction (mag) of the clouds over a patch of sky (deg), for stars at a distance (pc) */
function patchAV(l: number, b: number, pc: number, half = 1): number {
  let sum = 0;
  let n = 0;
  for (let dl = -half; dl <= half; dl += half / 2)
    for (let db = -half; db <= half; db += half / 2) {
      sum += 1.0857 * cloudDepth(CLOUD_BLOBS, fromSun(l + dl, b + db, pc), SUN);
      n++;
    }
  return sum / n;
}

describe("the dark clouds near the Sun", () => {
  test("fit the shaders' uniforms (four depths per vector, under the vertex uniform budget)", () => {
    expect(CLOUD_BLOBS.length % 4).toBe(0);
    expect(CLOUD_BLOBS.length).toBeLessThanOrEqual(128);
    for (const c of CLOUD_BLOBS) {
      expect(Math.hypot(c.center[0], c.center[1] + SUN_DISTANCE_KPC, c.center[2]) + 4 * c.sigma).toBeLessThanOrEqual(CLOUD_REACH_KPC);
    }
  });

  test("dim the stars behind them, not those in front", () => {
    for (const name of ["Pipe Nebula", "Ophiuchus", "Taurus", "Aquila Rift", "Orion A"]) {
      const c = DARK_CLOUDS.find((d) => d.name === name)!;
      expect(patchAV(c.l, c.b, c.pc * 4), name).toBeGreaterThan(1.2);
      expect(patchAV(c.l, c.b, c.pc * 0.6), name).toBeLessThan(0.05);
    }
  });

  test("never black out the sky behind them", () => {
    for (const c of DARK_CLOUDS) expect(patchAV(c.l, c.b, 3000, 0.5), c.name).toBeLessThan(1.0857 * CLOUD_MAX_TAU);
  });

  test("leave the high sky clear", () => {
    for (let l = 0; l < 360; l += 30) {
      expect(patchAV(l, 60, 2000)).toBeLessThan(0.05);
      expect(patchAV(l, -60, 2000)).toBeLessThan(0.05);
    }
  });
});
