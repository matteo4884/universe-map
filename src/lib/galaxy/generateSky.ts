import { KPC, SUN_DISTANCE_KPC } from "../../helper/galaxy";
import { seededRandom } from "../../helper/random";

/**
 * The stars of our night sky, placed in 3D around the Sun (model units, see
 * helper/galaxy.ts) with a real absolute magnitude each. MilkyWay draws them
 * with true photometry, so from Earth they look like the real sky (a few
 * bright stars, thousands of faint ones) and they brighten or fade as the
 * camera moves among them.
 */

export interface SkyStarData {
  positions: Float32Array;
  colors: Float32Array;
  absMags: Float32Array;
}

/** Faintest apparent magnitude kept (the naked eye reaches ~6.5) */
export const SKY_MAG_LIMIT = 7.5;
const STAR_COUNT = 24000;
const PARSECS_PER_KPC = 1000;

type StarClass = {
  share: number; // of the stars visible from the Sun
  mag: [number, number]; // absolute magnitude range
  color: [number, number, number];
  height: number; // scale height above the galactic plane (pc)
};

// The naked-eye sky is mostly hot young stars seen from afar and giants,
// plus the Sun-like stars nearby
const CLASSES: StarClass[] = [
  { share: 0.22, mag: [-4.5, -0.5], color: [0.62, 0.73, 1.0], height: 80 }, // B
  { share: 0.22, mag: [0.0, 2.0], color: [0.82, 0.87, 1.0], height: 120 }, // A
  { share: 0.12, mag: [1.5, 3.8], color: [1.0, 0.97, 0.92], height: 200 }, // F
  { share: 0.12, mag: [0.5, 5.0], color: [1.0, 0.92, 0.78], height: 250 }, // G
  { share: 0.28, mag: [-1.0, 1.5], color: [1.0, 0.8, 0.57], height: 300 }, // K giants
  { share: 0.04, mag: [-2.0, 0.0], color: [1.0, 0.66, 0.44], height: 300 }, // M giants
];

// A dozen luminaries a few parsecs away, like Sirius, Vega or Arcturus
const BRIGHTEST = 12;
const MAX_DISTANCE_PC = 2500;
const MIN_DISTANCE_PC = 1.3; // nothing closer than Proxima Centauri

function pickClass(random: () => number): StarClass {
  let x = random();
  for (const c of CLASSES) {
    x -= c.share;
    if (x <= 0) return c;
  }
  return CLASSES[CLASSES.length - 1];
}

/** A random direction, scaled */
function direction(random: () => number, length: number): [number, number, number] {
  const z = random() * 2 - 1;
  const r = Math.sqrt(1 - z * z);
  const phi = random() * Math.PI * 2;
  return [r * Math.cos(phi) * length, r * Math.sin(phi) * length, z * length];
}

export function generateSkyStars(): SkyStarData {
  const random = seededRandom(1610); // Galileo resolves the Milky Way into stars
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const absMags = new Float32Array(STAR_COUNT);
  const sunY = -SUN_DISTANCE_KPC * KPC;
  const unitsPerParsec = KPC / PARSECS_PER_KPC;

  for (let i = 0; i < STAR_COUNT; i++) {
    let mag: number;
    let color: [number, number, number];
    let offset: [number, number, number];
    if (i < BRIGHTEST) {
      // Apparent magnitude −1.5 to 1 for a Vega-like star sets its distance
      mag = 0.6;
      color = random() < 0.7 ? CLASSES[1].color : CLASSES[4].color;
      const apparent = -1.5 + random() * 2.5;
      offset = direction(random, Math.pow(10, (apparent - mag + 5) / 5));
    } else {
      const c = pickClass(random);
      mag = c.mag[0] + random() * (c.mag[1] - c.mag[0]);
      color = c.color;
      // Anywhere it would still be visible, uniform in volume, thinning away from the plane
      const reach = Math.min(Math.pow(10, (SKY_MAG_LIMIT - mag + 5) / 5), MAX_DISTANCE_PC);
      do offset = direction(random, reach * Math.cbrt(random()));
      while (
        Math.hypot(...offset) < MIN_DISTANCE_PC ||
        random() > Math.exp(-Math.abs(offset[2]) / c.height)
      );
    }
    positions[i * 3] = offset[0] * unitsPerParsec;
    positions[i * 3 + 1] = sunY + offset[1] * unitsPerParsec;
    positions[i * 3 + 2] = offset[2] * unitsPerParsec;
    colors.set(color, i * 3);
    absMags[i] = mag;
  }
  return { positions, colors, absMags };
}
