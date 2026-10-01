import { SUN_DISTANCE_KPC } from "./galaxy";
import { gaussian, seededRandom } from "./random";

/**
 * The dark clouds around the Sun: dust within ~1 kpc that splits the Milky
 * Way's band into the Great Rift and darkens patches of the sky, placed where
 * they really are (CO survey of Dame et al. 2001, Gaia distances of Zucker et
 * al. 2020). Each cloud is a few overlapping Gaussian blobs strung across it,
 * so its outline is irregular; anonymous clumps near the plane break up the
 * band's dark lane. Model axes, kpc (see galaxy.ts). The shaders integrate
 * the blobs exactly along each line of sight, made lumpy and stringy by 3D
 * noise (`cloudDepth` is the same sum).
 */

export type DarkCloud = {
  name: string;
  /** Galactic longitude and latitude of the center (deg) */
  l: number;
  b: number;
  /** Distance from the Sun (pc) */
  pc: number;
  /** Extent along longitude and latitude (deg) */
  size: [number, number];
  /** Visual extinction through its dense parts (magnitudes) */
  av: number;
};

export const DARK_CLOUDS: DarkCloud[] = [
  { name: "Taurus", l: 172, b: -15, pc: 140, size: [12, 9], av: 4 },
  { name: "Perseus", l: 159, b: -20, pc: 290, size: [7, 4], av: 4 },
  { name: "California", l: 161, b: -9, pc: 470, size: [10, 3], av: 3 },
  { name: "Orion A", l: 211, b: -19.5, pc: 400, size: [9, 3], av: 6 },
  { name: "Orion B", l: 206, b: -15.5, pc: 400, size: [5, 4], av: 5 },
  { name: "Ophiuchus", l: 355, b: 17, pc: 140, size: [9, 7], av: 8 },
  { name: "Pipe Nebula", l: 0, b: 5.5, pc: 145, size: [8, 3], av: 6 },
  { name: "Lupus", l: 339, b: 14, pc: 155, size: [10, 9], av: 3 },
  { name: "Corona Australis", l: 0, b: -18, pc: 150, size: [4, 2], av: 6 },
  { name: "Chamaeleon", l: 300, b: -16, pc: 190, size: [8, 5], av: 4 },
  { name: "Musca", l: 301, b: -9, pc: 170, size: [6, 1.5], av: 3 },
  { name: "Coalsack", l: 302, b: -1, pc: 180, size: [6, 6], av: 1.3 },
  { name: "Aquila Rift", l: 28, b: 4, pc: 250, size: [22, 14], av: 5 },
  { name: "Cygnus Rift", l: 80, b: 1, pc: 800, size: [16, 8], av: 5 },
  { name: "Cepheus Flare", l: 110, b: 15, pc: 350, size: [12, 9], av: 2.5 },
  { name: "Vela Ridge", l: 268, b: 0, pc: 900, size: [16, 4], av: 4 },
];

/** A Gaussian blob of dust: center (kpc, model axes), size (σ, kpc), optical depth through its center */
export type CloudBlob = { center: [number, number, number]; sigma: number; tau: number };

const BLOBS_PER_CLOUD = 5;
// Anonymous clumps near the plane, 0.25–1.2 kpc away
const CLUMPS = 20;
const BLOBS_PER_CLUMP = 2;
const MAG_PER_TAU = 1.0857;
const DEG = Math.PI / 180;

/** Model position (kpc) seen from the Sun at a galactic longitude and latitude (deg) and distance (pc) */
export function fromSun(l: number, b: number, pc: number): [number, number, number] {
  const d = pc / 1000;
  // Galactic x (toward the center) is model +y, galactic y (longitude 90°) is model −x
  return [
    -Math.sin(l * DEG) * Math.cos(b * DEG) * d,
    -SUN_DISTANCE_KPC + Math.cos(l * DEG) * Math.cos(b * DEG) * d,
    Math.sin(b * DEG) * d,
  ];
}

function buildBlobs(): CloudBlob[] {
  const random = seededRandom(1919); // Barnard's photographs of dark nebulae
  const blobs: CloudBlob[] = [];
  for (const c of DARK_CLOUDS) {
    // Strung along a random direction across the cloud, scattered around it
    const angle = random() * Math.PI;
    const dl = Math.cos(angle) * c.size[0];
    const db = Math.sin(angle) * c.size[1];
    const widthKpc = (c.pc / 1000) * Math.min(c.size[0], c.size[1]) * DEG;
    for (let i = 0; i < BLOBS_PER_CLOUD; i++) {
      const u = (i / (BLOBS_PER_CLOUD - 1) - 0.5) * 0.8 + gaussian(random) * 0.1;
      blobs.push({
        center: fromSun(
          c.l + dl * u + gaussian(random) * c.size[0] * 0.12,
          c.b + db * u + gaussian(random) * c.size[1] * 0.12,
          c.pc * (1 + gaussian(random) * 0.06)
        ),
        sigma: widthKpc * (0.18 + 0.2 * random()),
        tau: (c.av / MAG_PER_TAU) * (0.5 + 0.5 * random()),
      });
    }
  }
  for (let i = 0; i < CLUMPS; i++) {
    const pc = 250 + 950 * Math.sqrt(random());
    const l = random() * 360;
    const b = (gaussian(random) * 40) / pc / DEG; // ~40 pc from the plane
    const sigma = 0.012 + 0.025 * random();
    const tau = (1 + 2 * random()) / MAG_PER_TAU;
    for (let k = 0; k < BLOBS_PER_CLUMP; k++) {
      const [x, y, z] = fromSun(l, b, pc);
      blobs.push({
        center: [x + gaussian(random) * sigma, y + gaussian(random) * sigma, z + gaussian(random) * sigma * 0.5],
        sigma: sigma * (0.6 + 0.4 * random()),
        tau: tau * (0.6 + 0.4 * random()),
      });
    }
  }
  return blobs;
}

export const CLOUD_BLOBS = buildBlobs();

/** Beyond this distance from the Sun (kpc) the blobs don't reach: lines of sight passing farther skip them */
export const CLOUD_REACH_KPC = Math.max(
  ...CLOUD_BLOBS.map((c) => Math.hypot(c.center[0], c.center[1] + SUN_DISTANCE_KPC, c.center[2]) + 4 * c.sigma)
);

/** erf, close enough for dust (error < 0.4%): the shaders use the same */
function erf(x: number): number {
  return Math.sign(x) * Math.sqrt(1 - Math.exp((-x * x * 4) / Math.PI));
}

const fract = (x: number) => x - Math.floor(x);

function hash3(x: number, y: number, z: number): number {
  x = fract(x * 0.1031);
  y = fract(y * 0.1031);
  z = fract(z * 0.1031);
  const d = x * (z + 31.32) + y * (y + 31.32) + z * (x + 31.32);
  return fract((x + d + y + d) * (z + d));
}

function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const s = (t: number) => t * t * (3 - 2 * t);
  const fx = s(x - ix);
  const fy = s(y - iy);
  const fz = s(z - iz);
  const h = (i: number, j: number, k: number) => hash3(ix + i, iy + j, iz + k);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), fx), mix(h(0, 1, 0), h(1, 1, 0), fx), fy),
    mix(mix(h(0, 0, 1), h(1, 0, 1), fx), mix(h(0, 1, 1), h(1, 1, 1), fx), fy),
    fz
  );
}

/** Clouds are lumpy and stringy: their dust thickens and thins across them (1–4 pc), average ~1 */
function lumps(x: number, y: number, z: number): number {
  const n =
    noise3(x * 350, y * 350, z * 350) * 0.55 +
    noise3(x * 900, y * 900, z * 900) * 0.3 +
    noise3(x * 2200, y * 2200, z * 2200) * 0.15;
  return 0.05 + 6 * n * n * n;
}

/** Optical depth through the blobs along the segment from a to b (kpc, model axes), integrated exactly */
export function cloudDepth(blobs: CloudBlob[], a: [number, number, number], b: [number, number, number]): number {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len < 1e-9) return 0;
  const u = d.map((v) => v / len);
  let tau = 0;
  for (const c of blobs) {
    const m = [c.center[0] - a[0], c.center[1] - a[1], c.center[2] - a[2]];
    const t = m[0] * u[0] + m[1] * u[1] + m[2] * u[2];
    const q = [m[0] - u[0] * t, m[1] - u[1] * t, m[2] - u[2] * t];
    const perp2 = q[0] * q[0] + q[1] * q[1] + q[2] * q[2];
    if (perp2 > 16 * c.sigma * c.sigma) continue;
    const k = Math.SQRT1_2 / c.sigma;
    const through = Math.exp((-0.5 * perp2) / (c.sigma * c.sigma)) * 0.5 * (erf((len - t) * k) + erf(t * k));
    tau += c.tau * through * lumps(a[0] + u[0] * t, a[1] + u[1] * t, a[2] + u[2] * t);
  }
  return tau;
}
