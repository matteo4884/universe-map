import { describe, expect, test } from "vitest";
import * as THREE from "three";
import {
  ARMS,
  BAR,
  KPC,
  GALAXY_SCALE,
  GALACTIC_CENTER,
  GALACTIC_NORTH,
  SUN_DISTANCE_KPC,
  armOffset,
  armPoint,
  cameraUp,
  galaxyViewOffset,
  kpcToScene,
} from "../helper/galaxy";

const DEG = 180 / Math.PI;
const arm = (name: string) => ARMS.find((a) => a.name === name)!;

/** Ecliptic longitude and latitude (degrees) of a scene direction */
function ecliptic(v: THREE.Vector3): { lon: number; lat: number } {
  const n = v.clone().normalize();
  return { lon: (Math.atan2(n.y, n.x) * DEG + 360) % 360, lat: Math.asin(n.z) * DEG };
}

/** Where an arm's ridge crosses the Sun–center line, toward the Sun (kpc from the center) */
function crossingTowardSun(name: string): number {
  for (let r = 2; r < 16; r += 0.001) {
    const hit = armOffset(arm(name), 0, -r);
    if (hit && Math.abs(hit.offset) < 0.002) return r;
  }
  return NaN;
}

describe("the galaxy in the sky", () => {
  test("the Galactic Center is toward Sagittarius (ecliptic 266.8°, −5.5°)", () => {
    const { lon, lat } = ecliptic(GALACTIC_CENTER);
    expect(lon).toBeCloseTo(266.84, 1);
    expect(lat).toBeCloseTo(-5.54, 1);
  });

  test("the galactic pole is 60° from the ecliptic's", () => {
    const { lon, lat } = ecliptic(GALACTIC_NORTH);
    expect(lat).toBeCloseTo(29.81, 1);
    expect(lon).toBeCloseTo(180.02, 0);
  });

  test("the Sun is at the scene's origin, 8.2 kpc from the center", () => {
    expect(kpcToScene(0, -SUN_DISTANCE_KPC, 0).length()).toBeLessThan(1);
    expect(GALACTIC_CENTER.length()).toBeCloseTo(SUN_DISTANCE_KPC * KPC * GALAXY_SCALE, -3);
  });
});

describe("the galaxy's structure", () => {
  test("the Sun is in the Orion Spur", () => {
    const hit = armOffset(arm("Orion Spur"), 0, -SUN_DISTANCE_KPC);
    expect(hit).not.toBeNull();
    expect(Math.abs(hit!.offset)).toBeLessThan(arm("Orion Spur").width);
  });

  test("toward the center: Sagittarius ~1 kpc in, Scutum ~3 kpc in; Perseus ~2 kpc out", () => {
    expect(SUN_DISTANCE_KPC - crossingTowardSun("Sagittarius–Carina")).toBeGreaterThan(0.8);
    expect(SUN_DISTANCE_KPC - crossingTowardSun("Sagittarius–Carina")).toBeLessThan(1.8);
    expect(SUN_DISTANCE_KPC - crossingTowardSun("Scutum–Centaurus")).toBeGreaterThan(2.5);
    expect(crossingTowardSun("Perseus") - SUN_DISTANCE_KPC).toBeGreaterThan(1.5);
    expect(crossingTowardSun("Perseus") - SUN_DISTANCE_KPC).toBeLessThan(2.6);
    expect(crossingTowardSun("Norma–Outer") - SUN_DISTANCE_KPC).toBeGreaterThan(4.5); // the Outer Arm
  });

  test("the major arms leave from the two ends of the bar", () => {
    for (const [name, end] of [["Scutum–Centaurus", 0], ["Perseus", Math.PI]] as const) {
      const [x, y] = armPoint(arm(name), 0);
      const angle = Math.atan2(y, x);
      const diff = Math.abs(((angle - (BAR.angle + end)) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      expect(diff * DEG).toBeLessThan(2);
      expect(Math.hypot(x, y)).toBeGreaterThanOrEqual(BAR.halfLength);
    }
  });

  test("the bar's near end is at positive longitudes, 28° from the Sun–center line", () => {
    // Seen from the Sun (center straight ahead), longitude grows to the left (−x)
    const nearEnd = new THREE.Vector2(Math.cos(BAR.angle), Math.sin(BAR.angle));
    expect(nearEnd.x).toBeLessThan(0);
    expect(nearEnd.y).toBeLessThan(0);
    expect(Math.abs(Math.atan2(-nearEnd.x, -nearEnd.y) * DEG)).toBeCloseTo(28, 5);
  });
});

describe("camera", () => {
  test("up is the ecliptic's north among the planets, the galaxy's far out", () => {
    const up = new THREE.Vector3();
    expect(cameraUp(1000, up).toArray()).toEqual([0, 0, 1]);
    expect(cameraUp(1e12, up).distanceTo(GALACTIC_NORTH)).toBeLessThan(1e-9);
    expect(cameraUp(1e8, up).length()).toBeCloseTo(1, 12);
  });

  test("the galaxy view looks from the north side, backing off on portrait screens", () => {
    const wide = galaxyViewOffset(16 / 9, 50);
    const tall = galaxyViewOffset(9 / 19, 50);
    expect(Math.acos(wide.clone().normalize().dot(GALACTIC_NORTH)) * DEG).toBeCloseTo(35, 6);
    expect(tall.length()).toBeGreaterThan(wide.length() * 2);
  });
});
