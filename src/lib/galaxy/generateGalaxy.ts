import { ARMS, Arm, BAR, DISK, KPC, SUN_DISTANCE_KPC, armPoint } from "../../helper/galaxy";
import { seededRandom, gaussian } from "../../helper/random";

/**
 * Star particles of the Milky Way model (see helper/galaxy.ts), in model units
 * (100 ly). Each one is a cluster of stars with its own absolute magnitude:
 * MilkyWay draws them with the same photometry as single stars, so they are
 * the Milky Way's band seen from the planets and the galaxy's sparkle from
 * afar, brightening and fading only with distance.
 */

export interface GalaxyData {
  positions: Float32Array;
  colors: Float32Array;
  absMags: Float32Array;
}

// A typical particle's absolute magnitude: from the Sun the clusters make a band
// of faint stars (a few dozen as bright as mag 4, tens of thousands fainter
// than 8), and from outside the galaxy thousands still show
const PARTICLE_MAG = -5;
const PARTICLE_MAG_SPREAD = 1.0;
// The Sun's neighborhood is drawn star by star (generateSky): clusters thin out
// within these distances (kpc), so none sits right next to us outshining the real stars
const NEIGHBORHOOD_FROM = 0.8;
const NEIGHBORHOOD_TO = 2.2;

const COUNTS = {
  bulge: 14000,
  bar: 10000,
  thinDisk: 46000,
  thickDisk: 7000,
  armOld: 18000,
  armYoung: 42000,
  halo: 2500,
  globulars: 160,
};

// Re-seeded by each generator: the same galaxy and sky on every visit
let random = seededRandom(1);
const gauss = () => gaussian(random);

/** Exponential (Laplace) height above the plane */
function height(scale: number): number {
  return -scale * Math.log(random() || 1e-12) * (random() < 0.5 ? -1 : 1);
}

/** Radius for a surface density ∝ e^(−R/h), out to `max` (kpc) */
function diskRadius(h: number, max: number): number {
  for (;;) {
    const r = -h * Math.log((random() || 1e-12) * (random() || 1e-12));
    if (r < max) return r;
  }
}

// Arms are picked in proportion to these weights
function pickArm(weight: (a: Arm) => number): Arm {
  const total = ARMS.reduce((sum, a) => sum + weight(a), 0);
  let x = random() * total;
  for (const a of ARMS) {
    x -= weight(a);
    if (x <= 0) return a;
  }
  return ARMS[0];
}

/** A point along an arm, denser where the arm is closer in (brighter inner disk) */
function alongArm(a: Arm): number {
  for (;;) {
    const along = random() * a.span;
    const r = a.r * Math.exp(along * a.tanPitch);
    // Fade in at the start, out over the last 40%, exponential disk light
    const fadeIn = Math.min(along / 0.35, 1);
    const fadeOut = Math.min((a.span - along) / (a.span * 0.4), 1);
    const p = fadeIn * fadeOut * Math.exp(-(r - a.r) / (DISK.scaleLength * 2.2));
    if (random() < p) return along;
  }
}

/** Unit vector perpendicular to the arm (pointing outward) at `along` */
function armNormal(a: Arm, along: number): [number, number] {
  const phi = a.angle + along;
  // Tangent of r·e^{φ·k}: (k cos φ − sin φ, k sin φ + cos φ); outward normal is it turned clockwise
  const tx = a.tanPitch * Math.cos(phi) - Math.sin(phi);
  const ty = a.tanPitch * Math.sin(phi) + Math.cos(phi);
  const len = Math.hypot(tx, ty);
  return [ty / len, -tx / len];
}

/** Position (kpc), color, and brightness relative to a typical particle (magnitudes, < 0 brighter) */
type Star = [x: number, y: number, z: number, r: number, g: number, b: number, dMag: number];

function warm(jitter = 0.08): [number, number, number] {
  const j = (random() - 0.5) * jitter;
  return [1.0, 0.82 + j, 0.6 + j];
}

function bulgeStar(): Star {
  // Boxy bulge aligned with the bar
  const u = gauss() * 1.0;
  const v = gauss() * 0.5;
  const z = gauss() * 0.42;
  const c = Math.cos(BAR.angle), s = Math.sin(BAR.angle);
  return [u * c - v * s, u * s + v * c, z, ...warm(), 0.3];
}

function barStar(): Star {
  // Flat along its length, rounded ends
  const u = (random() * 2 - 1) * BAR.halfLength * 0.8 + gauss() * 0.4;
  const taper = 1 - 0.5 * Math.min(Math.abs(u) / BAR.halfLength, 1);
  const v = gauss() * BAR.halfWidth * 0.4 * taper;
  const z = gauss() * 0.18;
  const c = Math.cos(BAR.angle), s = Math.sin(BAR.angle);
  return [u * c - v * s, u * s + v * c, z, ...warm(), 0.4];
}

function thinDiskStar(): Star {
  const r = diskRadius(DISK.scaleLength, DISK.edge);
  const phi = random() * Math.PI * 2;
  // The disk flares beyond ~10 kpc
  const z = height(DISK.scaleHeight * (1 + Math.max(r - 10, 0) * 0.12));
  const t = random();
  return [r * Math.cos(phi), r * Math.sin(phi), z, 1.0, 0.88 + t * 0.08, 0.74 + t * 0.14, 0.5];
}

function thickDiskStar(): Star {
  const r = diskRadius(2.0, DISK.edge);
  const phi = random() * Math.PI * 2;
  return [r * Math.cos(phi), r * Math.sin(phi), height(0.9), ...warm(), 0.9];
}

function armOldStar(): Star {
  const a = pickArm((arm) => (arm.major ? 1 : 0.25) * arm.strength);
  const along = alongArm(a);
  const [x, y] = armPoint(a, along);
  const [nx, ny] = armNormal(a, along);
  const off = gauss() * a.width * 2.4;
  return [x + nx * off, y + ny * off, height(0.22), 1.0, 0.93, 0.84, 0.4];
}

function armYoungStars(out: Star[], count: number) {
  // Young stars are born in clusters along the arms' ridges
  while (count > 0) {
    const a = pickArm((arm) => arm.strength);
    const along = alongArm(a);
    const [x, y] = armPoint(a, along);
    const [nx, ny] = armNormal(a, along);
    const off = gauss() * a.width * 0.8;
    const cx = x + nx * off, cy = y + ny * off;
    const members = Math.min(count, 4 + Math.floor(random() * 18));
    const spread = 0.05 + random() * 0.12;
    // A few clusters still glow pink with ionized hydrogen (HII regions)
    const nebula = random() < 0.12;
    for (let i = 0; i < members; i++) {
      const t = random();
      const color: [number, number, number] = nebula
        ? [1.0, 0.42 + t * 0.12, 0.62 + t * 0.1]
        : [0.66 + t * 0.3, 0.78 + t * 0.18, 1.0];
      // Young clusters are bright with hot blue stars
      out.push([cx + gauss() * spread, cy + gauss() * spread, height(0.07), ...color, nebula ? -0.7 : -0.4]);
    }
    count -= members;
  }
}

/** Halo: radius with density ∝ r^−3.5 beyond ~1 kpc, slightly flattened */
function haloPosition(maxR: number): [number, number, number] {
  let r: number;
  do r = Math.pow(random() || 1e-12, -1 / 0.5); // ∝ r^−3.5 → P(>r) ∝ r^−0.5
  while (r > maxR);
  const cosT = random() * 2 - 1;
  const sinT = Math.sqrt(1 - cosT * cosT);
  const phi = random() * Math.PI * 2;
  return [r * sinT * Math.cos(phi), r * sinT * Math.sin(phi), r * cosT * 0.75];
}

export function generateGalaxy(): GalaxyData {
  random = seededRandom(26700);
  const stars: Star[] = [];
  for (let i = 0; i < COUNTS.bulge; i++) stars.push(bulgeStar());
  for (let i = 0; i < COUNTS.bar; i++) stars.push(barStar());
  for (let i = 0; i < COUNTS.thinDisk; i++) stars.push(thinDiskStar());
  for (let i = 0; i < COUNTS.thickDisk; i++) stars.push(thickDiskStar());
  for (let i = 0; i < COUNTS.armOld; i++) stars.push(armOldStar());
  armYoungStars(stars, COUNTS.armYoung);
  for (let i = 0; i < COUNTS.halo; i++) stars.push([...haloPosition(30), ...warm(0.15), 1.5]);
  // Globular clusters: one particle each, a little brighter than the rest
  for (let i = 0; i < COUNTS.globulars; i++) stars.push([...haloPosition(40), 1.0, 0.9, 0.72, -0.5]);

  return pack(stars);
}

function pack(stars: Star[]): GalaxyData {
  const kept = stars.filter(([x, y, z]) => {
    const fromSun = Math.hypot(x, y + SUN_DISTANCE_KPC, z);
    const t = Math.min(Math.max((fromSun - NEIGHBORHOOD_FROM) / (NEIGHBORHOOD_TO - NEIGHBORHOOD_FROM), 0), 1);
    return random() < t * t * (3 - 2 * t);
  });
  const n = kept.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const absMags = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [x, y, z, r, g, b, dMag] = kept[i];
    positions[i * 3] = x * KPC;
    positions[i * 3 + 1] = y * KPC;
    positions[i * 3 + 2] = z * KPC;
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    absMags[i] = PARTICLE_MAG + dMag + gauss() * PARTICLE_MAG_SPREAD;
  }
  return { positions, colors, absMags };
}
