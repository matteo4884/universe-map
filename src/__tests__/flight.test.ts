import { describe, expect, test } from "vitest";
import { zoomPath, peakDistance, flightEase, flightTiming } from "../helper/flight";

describe("zoom path", () => {
  const cases: [string, number, number, number][] = [
    ["planet to planet", 12, 44, 500],
    ["galaxy to the Solar System", 2.6e11, 1100, 6.7e10],
    ["galaxy to a moon", 2.6e11, 2, 6.7e10],
    ["same place, closer", 1100, 12, 0],
  ];

  for (const [name, w0, w1, d] of cases) {
    test(`${name}: starts and ends exactly where asked`, () => {
      const path = zoomPath(w0, w1, d);
      expect(Number.isFinite(path.length)).toBe(true);
      expect(path.at(0).u).toBeCloseTo(0, 9);
      expect(path.at(0).w / w0).toBeCloseTo(1, 9);
      expect(path.at(path.length).u).toBeCloseTo(1, 6);
      expect(path.at(path.length).w / w1).toBeCloseTo(1, 6);
    });

    test(`${name}: always moves forward`, () => {
      const path = zoomPath(w0, w1, d);
      let last = -Infinity;
      for (let i = 0; i <= 200; i++) {
        const { u, w } = path.at((path.length * i) / 200);
        expect(u).toBeGreaterThanOrEqual(last - 1e-12);
        expect(w).toBeGreaterThan(0);
        last = u;
      }
    });
  }

  test("a pure zoom takes the same time for every tenfold step", () => {
    const path = zoomPath(1e11, 1e3, 0);
    const decades = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.log10(path.at(path.length * f).w));
    expect(decades).toEqual([11, 9, 7, 5, 3].map((x) => expect.closeTo(x, 9)));
  });

  test("crossing far, it zooms out to see both ends", () => {
    const path = zoomPath(12, 44, 500);
    expect(peakDistance(path, 12, 44)).toBeGreaterThan(200);
  });

  test("zooming into a nearby target doesn't zoom out first", () => {
    const path = zoomPath(2.6e11, 1100, 6.7e10);
    expect(peakDistance(path, 2.6e11, 1100)).toBeCloseTo(2.6e11, -6);
  });
});

describe("flight easing", () => {
  test("goes from 0 to 1 without going back", () => {
    for (const [a, b] of [[0.5, 0.5], [0.2, 0.3], [0.1, 0.5]]) {
      expect(flightEase(0, a, b)).toBe(0);
      expect(flightEase(1, a, b)).toBeCloseTo(1, 12);
      let last = 0;
      for (let i = 1; i <= 1000; i++) {
        const p = flightEase(i / 1000, a, b);
        expect(p).toBeGreaterThanOrEqual(last);
        expect(p - last).toBeLessThan(0.01); // no jumps
        last = p;
      }
    }
  });

  test("starts and stops from rest, symmetric when the ramps are", () => {
    const dt = 1e-4;
    expect(flightEase(dt, 0.3, 0.3) / dt).toBeLessThan(0.01);
    expect((1 - flightEase(1 - dt, 0.3, 0.3)) / dt).toBeLessThan(0.01);
    for (const t of [0.1, 0.3, 0.5, 0.8]) {
      expect(flightEase(t, 0.5, 0.5) + flightEase(1 - t, 0.5, 0.5)).toBeCloseTo(1, 12);
    }
  });

  test("long flights are capped, reduced motion is short", () => {
    expect(flightTiming(100).duration).toBe(5);
    expect(flightTiming(0).duration).toBe(1);
    expect(flightTiming(100, true).duration).toBe(0.6);
  });
});
