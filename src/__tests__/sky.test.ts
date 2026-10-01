import { describe, expect, test } from "vitest";
import { generateSkyStars, SKY_MAG_LIMIT } from "../lib/galaxy/generateSky";
import { KPC, SUN_DISTANCE_KPC } from "../helper/galaxy";

/** Apparent magnitudes of a star set seen from a point (kpc, model axes) */
function seenFrom(
  stars: { positions: Float32Array; absMags: Float32Array },
  [cx, cy, cz]: [number, number, number]
): { mag: number; parsecs: number }[] {
  return Array.from(stars.absMags, (absMag, i) => {
    const parsecs =
      Math.hypot(
        stars.positions[i * 3] / KPC - cx,
        stars.positions[i * 3 + 1] / KPC - cy,
        stars.positions[i * 3 + 2] / KPC - cz
      ) * 1000;
    return { mag: absMag + 5 * Math.log10(parsecs / 10), parsecs };
  });
}

const SUN: [number, number, number] = [0, -SUN_DISTANCE_KPC, 0];

const sky = generateSkyStars();
const skyFromSun = seenFrom(sky, SUN);
const brighterThan = (list: { mag: number }[], m: number) => list.filter((s) => s.mag < m).length;

describe("the night sky", () => {
  // Real sky: ~170 stars brighter than magnitude 3, ~4,800 than 6
  test("has about the real number of stars per magnitude", () => {
    expect(brighterThan(skyFromSun, 1)).toBeGreaterThanOrEqual(5);
    expect(brighterThan(skyFromSun, 3)).toBeGreaterThan(100);
    expect(brighterThan(skyFromSun, 3)).toBeLessThan(300);
    expect(brighterThan(skyFromSun, 6)).toBeGreaterThan(3000);
    expect(brighterThan(skyFromSun, 6)).toBeLessThan(7000);
    expect(brighterThan(skyFromSun, SKY_MAG_LIMIT + 0.01)).toBe(skyFromSun.length);
  });

  test("no star closer than Proxima Centauri", () => {
    expect(Math.min(...skyFromSun.map((s) => s.parsecs))).toBeGreaterThanOrEqual(1.3);
  });

  test("is the same on every visit", () => {
    expect(generateSkyStars().positions).toEqual(sky.positions);
  });
});
