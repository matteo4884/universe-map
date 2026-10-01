import * as THREE from "three";

/**
 * The Milky Way model.
 *
 * Model units: 100 light-years. Galactic Center at the origin, disk in the xy
 * plane, +z toward the north galactic pole. Seen from the north the galaxy
 * turns clockwise, its arms trail (they wind outward counterclockwise) and the
 * Sun sits at (0, −R☉): the usual map, Sun at the bottom, center above it.
 *
 * A long bar 28° from the Sun–center line, near end at positive longitudes;
 * the two major arms (Scutum–Centaurus, Perseus) leave from its ends, the two
 * minor arms (Sagittarius–Carina, Norma–Outer) lie between them, the 3-kpc
 * arms hug the bar and the Sun is in the Orion Spur. After Reid et al.
 * 2014/2019 (maser parallaxes), Churchwell et al. 2009 (Spitzer GLIMPSE),
 * Wegg et al. 2015 (bar) and GRAVITY 2019 (R☉ = 8.18 kpc).
 */

const DEG = Math.PI / 180;

/** Model units per kiloparsec (1 kpc = 3,261.6 light-years) */
export const KPC = 32.6156;

export const SUN_DISTANCE_KPC = 8.2;
export const SUN_MODEL = new THREE.Vector3(0, -SUN_DISTANCE_KPC * KPC, 0);

/** Scene units per model unit. The galaxy is a backdrop, not to the Solar System's scale */
export const GALAXY_SCALE = 250000000;

/** The bar: half-length and half-width (kpc), angle of its near end (rad, counterclockwise from +x) */
export const BAR = { halfLength: 4.4, halfWidth: 1.1, angle: (270 - 28) * DEG };

/** Stellar disk: exponential scale length, outer edge, scale height (kpc) */
export const DISK = { scaleLength: 2.6, edge: 15.5, scaleHeight: 0.3 };

export type Arm = {
  name: string;
  /** Start of the log spiral R(φ) = r·e^{φ·tanPitch}: radius (kpc) and angle (rad) */
  r: number;
  angle: number;
  /** > 0 winds outward counterclockwise (a trailing arm) */
  tanPitch: number;
  /** Angular extent from the start (rad) */
  span: number;
  /** Gaussian σ of the star-forming ridge (kpc) */
  width: number;
  /** Brightness, 1 for the major arms */
  strength: number;
  /** Major arms gather the old stars too; minor arms are mostly gas and young stars */
  major: boolean;
  /** Names written along the arm, at an angle from its start (rad) */
  labels: { text: string; at: number }[];
};

function arm(
  name: string,
  r: number,
  angleDeg: number,
  pitchDeg: number,
  spanDeg: number,
  width: number,
  strength: number,
  major: boolean,
  labels: [string, number][] = []
): Arm {
  return {
    name,
    r,
    angle: angleDeg * DEG,
    tanPitch: Math.tan(pitchDeg * DEG),
    span: spanDeg * DEG,
    width,
    strength,
    major,
    labels: labels.map(([text, at]) => ({ text, at: at * DEG })),
  };
}

export const ARMS: Arm[] = [
  arm("Scutum–Centaurus", 4.6, 242, 12.5, 290, 0.42, 1, true, [["Scutum–Centaurus Arm", 150]]),
  arm("Perseus", 4.6, 62, 12.5, 300, 0.42, 1, true, [["Perseus Arm", 228]]),
  arm("Sagittarius–Carina", 4.0, 125, 12.5, 300, 0.32, 0.75, false, [["Sagittarius–Carina Arm", 205]]),
  arm("Norma–Outer", 4.0, 305, 12.5, 340, 0.32, 0.75, false, [["Norma Arm", 165], ["Outer Arm", 250]]),
  arm("Orion Spur", 7.3, 232, 11.5, 73, 0.22, 0.45, false, [["Orion Spur", 12]]),
  arm("Near 3-kpc", 3.4, 225, -3, 95, 0.16, 0.3, false),
  arm("Far 3-kpc", 3.4, 45, -3, 95, 0.16, 0.3, false),
];

/** Point on an arm's ridge, `along` radians from its start (kpc) */
export function armPoint(a: Arm, along: number): [number, number] {
  const r = a.r * Math.exp(along * a.tanPitch);
  return [r * Math.cos(a.angle + along), r * Math.sin(a.angle + along)];
}

/** Names written on the galaxy view: the center (a point, named beside it) and the arms */
export const GALAXY_LANDMARKS: { key: string; text: string; sub?: string; point?: boolean; kpc: [number, number] }[] = [
  { key: "center", text: "Galactic Center", sub: "Sagittarius A*", point: true, kpc: [0, 0] },
  ...ARMS.flatMap((a) => a.labels.map((l) => ({ key: l.text, text: l.text, kpc: armPoint(a, l.at) }))),
];

/**
 * Signed distance (kpc) from a point to an arm's ridge, measured along the ray
 * from the center (> 0 outside the arm), and how far along the arm (rad) that
 * crossing is. null when the arm doesn't cross that ray.
 */
export function armOffset(a: Arm, x: number, y: number): { offset: number; along: number } | null {
  const R = Math.hypot(x, y);
  if (R < 1e-6) return null;
  const theta = Math.atan2(y, x);
  // Windings cross the ray at R_j = r·e^{(θ + 2πj − angle)·tanPitch}: take the nearest
  const base = theta - a.angle;
  const j = Math.round((Math.log(R / a.r) / a.tanPitch - base) / (2 * Math.PI));
  const along = base + 2 * Math.PI * j;
  if (along < 0 || along > a.span) return null;
  const ridge = a.r * Math.exp(along * a.tanPitch);
  return { offset: (R - ridge) / Math.sqrt(1 + a.tanPitch * a.tanPitch), along };
}

// ---- Placing the model in the scene (ecliptic J2000, Sun at the origin) ----

// Model → galactic axes (x toward the center, y toward longitude 90°, z north)
const MODEL_TO_GALACTIC = new THREE.Matrix4().set(
  0, 1, 0, 0,
  -1, 0, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
);
// Galactic → equatorial J2000: columns are the galactic axes in equatorial coordinates
const GALACTIC_TO_EQUATORIAL = new THREE.Matrix4().set(
  -0.0548755604, 0.4941094279, -0.867666149, 0,
  -0.8734370902, -0.44482963, -0.1980763734, 0,
  -0.4838350155, 0.7469822445, 0.4559837762, 0,
  0, 0, 0, 1
);
// Equatorial → ecliptic: tilt by the obliquity of the ecliptic
const EQUATORIAL_TO_ECLIPTIC = new THREE.Matrix4().makeRotationX(-23.4392911 * DEG);

const MODEL_ROTATION = new THREE.Matrix4()
  .multiply(EQUATORIAL_TO_ECLIPTIC)
  .multiply(GALACTIC_TO_EQUATORIAL)
  .multiply(MODEL_TO_GALACTIC);

/** Galactic Center in the scene */
export const GALACTIC_CENTER = SUN_MODEL.clone().negate().applyMatrix4(MODEL_ROTATION).multiplyScalar(GALAXY_SCALE);

/** Model → scene: rotate into the ecliptic frame, scale, and put the Sun at the origin */
export const GALAXY_MATRIX = new THREE.Matrix4()
  .makeTranslation(GALACTIC_CENTER.x, GALACTIC_CENTER.y, GALACTIC_CENTER.z)
  .multiply(MODEL_ROTATION)
  .multiply(new THREE.Matrix4().makeScale(GALAXY_SCALE, GALAXY_SCALE, GALAXY_SCALE));

export const GALAXY_MATRIX_INVERSE = GALAXY_MATRIX.clone().invert();

/** North galactic pole, as a scene direction (the ecliptic is tilted ~60° to the galaxy) */
export const GALACTIC_NORTH = new THREE.Vector3(0, 0, 1).applyMatrix4(MODEL_ROTATION).normalize();

/** Scene position of a model point given in kpc */
export function kpcToScene(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x * KPC, y * KPC, z * KPC).applyMatrix4(GALAXY_MATRIX);
}

// ---- Camera ----

const ECLIPTIC_NORTH = new THREE.Vector3(0, 0, 1);
// The camera's "up" turns from the ecliptic's north to the galaxy's between
// these distances from the Sun (log10 of scene units): beyond the Solar
// System, before the galaxy's structure shows
const UP_TURN_FROM = 7;
const UP_TURN_TO = 9.5;

/** Camera "up" at this distance from the Sun: ecliptic north near the planets, galactic north far out */
export function cameraUp(distanceFromSun: number, out: THREE.Vector3): THREE.Vector3 {
  const x = (Math.log10(Math.max(distanceFromSun, 1)) - UP_TURN_FROM) / (UP_TURN_TO - UP_TURN_FROM);
  const k = Math.min(Math.max(x, 0), 1);
  return out.copy(ECLIPTIC_NORTH).lerp(GALACTIC_NORTH, k * k * (3 - 2 * k)).normalize();
}

const VIEW_RADIUS_KPC = 16; // the disk out to the Outer Arm

/** The ways to look at the whole galaxy: tilted with the Sun's side nearest, face-on, edge-on */
export type GalaxyView = "overview" | "top" | "side";

// Angle from the galactic pole (top: nudged off it, so "up" stays defined)
const VIEW_TILT: Record<GalaxyView, number> = { overview: 35 * DEG, top: 0.1 * DEG, side: 86 * DEG };

/** Camera offset from the Galactic Center that shows the whole galaxy */
export function galaxyViewOffset(aspect: number, fovDeg: number, view: GalaxyView = "overview"): THREE.Vector3 {
  const tilt = VIEW_TILT[view];
  const radius = VIEW_RADIUS_KPC * KPC * GALAXY_SCALE;
  const halfHeight = Math.tan((fovDeg * DEG) / 2);
  const dist = (1.12 * radius * Math.max(Math.cos(tilt), 1 / aspect)) / halfHeight;
  // Overview and top from the Sun's side (the Sun below the center, as on maps),
  // the edge-on view from a quarter turn away, the Sun off to one side
  const towardSun = GALACTIC_CENTER.clone().negate().normalize();
  const across = view === "side" ? GALACTIC_NORTH.clone().cross(towardSun) : towardSun;
  return GALACTIC_NORTH.clone()
    .multiplyScalar(Math.cos(tilt))
    .addScaledVector(across, Math.sin(tilt))
    .multiplyScalar(dist);
}
