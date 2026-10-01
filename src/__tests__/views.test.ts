import { describe, expect, test } from "vitest";
import { systemRadius, systemViewOffset } from "../helper/views";

const FOV = 50;
const HALF = Math.tan((FOV * Math.PI) / 360);

describe("the Solar System's views", () => {
  for (const aspect of [16 / 9, 4 / 3, 9 / 19]) {
    for (const blend of [0, 1]) {
      test(`top: Neptune's whole orbit in frame (aspect ${aspect.toFixed(2)}, blend ${blend})`, () => {
        const [x, y, z] = systemViewOffset("top", blend, aspect, FOV);
        const d = Math.hypot(x, y, z);
        // Seen from above, the orbit's radius must fit the shorter side of the screen
        expect(systemRadius(blend) / d).toBeLessThan(HALF * Math.min(1, aspect));
        expect(z / d).toBeGreaterThan(0.999);
      });

      test(`side: a little above the plane, the orbit's width in frame (aspect ${aspect.toFixed(2)}, blend ${blend})`, () => {
        const [, y, z] = systemViewOffset("side", blend, aspect, FOV);
        const d = Math.hypot(y, z);
        expect((Math.atan2(z, y) * 180) / Math.PI).toBeCloseTo(12, 6);
        expect(systemRadius(blend) / d).toBeLessThan(HALF * aspect);
      });
    }
  }
});
