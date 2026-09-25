import * as THREE from "three";

export const KM_PER_UNIT = 6371; // 1 Three.js unit = 1 Earth radius in realistic mode
const LOG_POWER = 0.3;

// Log scale for distances (preserves direction, compresses magnitude)
export function logScalePosition(
  x: number,
  y: number,
  z: number
): [number, number, number] {
  const d = Math.sqrt(x * x + y * y + z * z);
  if (d === 0) return [0, 0, 0];
  const dLog = Math.pow(d, LOG_POWER);
  return [(x / d) * dLog, (y / d) * dLog, (z / d) * dLog];
}

// Radii in "easy" mode: small bodies boosted 3x, but never past RADIUS_BOOST_CAP,
// so a boosted body can't outgrow one left at real size (Uranus vs Jupiter).
// Monotonic: a bigger body is never drawn smaller than a smaller one.
const RADIUS_BOOST = 3;
const RADIUS_BOOST_CAP = 5;
const MIN_RADIUS = 0.5;

export function logScaleRadius(radiusKm: number): number {
  if (radiusKm <= 0) return 0;
  const realUnits = radiusKm / KM_PER_UNIT;
  return Math.max(
    realUnits,
    Math.min(realUnits * RADIUS_BOOST, RADIUS_BOOST_CAP),
    MIN_RADIUS
  );
}

// Log scale for moon-relative distances (lower power to keep moons close to parent)
const LOG_POWER_MOON = 0.2;

/**
 * Moon offset from its planet in log mode. The compressed distance is measured
 * from `baseUnits` (the planet's log radius, or its ring edge) rather than from
 * the planet's center, so boosted planets never swallow their moons.
 */
export function logScaleMoonPosition(
  relX: number,
  relY: number,
  relZ: number,
  baseUnits: number
): [number, number, number] {
  const d = Math.sqrt(relX * relX + relY * relY + relZ * relZ);
  if (d === 0) return [0, 0, 0];
  const dLog = baseUnits + Math.pow(d, LOG_POWER_MOON);
  return [(relX / d) * dLog, (relY / d) * dLog, (relZ / d) * dLog];
}

// Blended moon position: lerp between log-moon and realistic
export function blendMoonPosition(
  relX: number,
  relY: number,
  relZ: number,
  blend: number,
  baseUnits: number
): [number, number, number] {
  const logPos = logScaleMoonPosition(relX, relY, relZ, baseUnits);
  const realPos: [number, number, number] = [
    relX / KM_PER_UNIT,
    relY / KM_PER_UNIT,
    relZ / KM_PER_UNIT,
  ];
  return [
    logPos[0] + (realPos[0] - logPos[0]) * blend,
    logPos[1] + (realPos[1] - logPos[1]) * blend,
    logPos[2] + (realPos[2] - logPos[2]) * blend,
  ];
}

// Blended position: lerp between log and realistic
export function blendPosition(
  x: number,
  y: number,
  z: number,
  blend: number // 0 = log, 1 = realistic
): [number, number, number] {
  const logPos = logScalePosition(x, y, z);
  const realPos: [number, number, number] = [
    x / KM_PER_UNIT,
    y / KM_PER_UNIT,
    z / KM_PER_UNIT,
  ];
  return [
    logPos[0] + (realPos[0] - logPos[0]) * blend,
    logPos[1] + (realPos[1] - logPos[1]) * blend,
    logPos[2] + (realPos[2] - logPos[2]) * blend,
  ];
}

// Blended radius: lerp between log and realistic
export function blendRadius(radiusKm: number, blend: number): number {
  const logR = logScaleRadius(radiusKm);
  const realR = radiusKm / KM_PER_UNIT;
  return logR + (realR - logR) * blend;
}

// Earth's obliquity — needed to convert equatorial RA/Dec to ecliptic coordinates
const OBLIQUITY = 23.4393 * (Math.PI / 180);
const COS_OBL = Math.cos(OBLIQUITY);
const SIN_OBL = Math.sin(OBLIQUITY);

const _defaultPole = new THREE.Vector3(0, 1, 0);

/**
 * Convert a north-pole RA/Dec (equatorial J2000, degrees) into a unit
 * vector in ecliptic coordinates (matching the Horizons coordinate system).
 */
export function poleToEcliptic(
  poleRADeg: number,
  poleDecDeg: number
): THREE.Vector3 {
  const ra = poleRADeg * (Math.PI / 180);
  const dec = poleDecDeg * (Math.PI / 180);

  // Unit vector in equatorial J2000
  const xEq = Math.cos(dec) * Math.cos(ra);
  const yEq = Math.cos(dec) * Math.sin(ra);
  const zEq = Math.sin(dec);

  // Rotate to ecliptic (rotate around X-axis by +obliquity)
  return new THREE.Vector3(
    xEq,
    yEq * COS_OBL + zEq * SIN_OBL,
    -yEq * SIN_OBL + zEq * COS_OBL
  ).normalize();
}

/**
 * Quaternion that orients a sphere whose default poles are along ±Y
 * so that its north pole points in the correct ecliptic direction.
 */
export function poleToQuaternion(
  poleRADeg: number,
  poleDecDeg: number
): THREE.Quaternion {
  const targetPole = poleToEcliptic(poleRADeg, poleDecDeg);
  return new THREE.Quaternion().setFromUnitVectors(_defaultPole, targetPole);
}

const J2000_JD = 2451545.0;
const MS_PER_DAY = 86400000;
const JD_UNIX_EPOCH = 2440587.5;
const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = 2 * Math.PI;

/**
 * Earth Rotation Angle — exact sidereal rotation from UTC time.
 * Direct IAU 2000 formula, no ambiguous reference direction.
 */
export function getEarthSpinAngle(now: Date): number {
  const jd = now.getTime() / MS_PER_DAY + JD_UNIX_EPOCH;
  const du = jd - J2000_JD;
  return TWO_PI * (0.7790572732640 + 1.0027378119113546 * du);
}

/**
 * Compute a body's current spin angle from IAU rotation parameters.
 * For non-Earth bodies.
 */
export function getSpinAngle(W0: number, spinRate: number, now: Date): number {
  const jd = now.getTime() / MS_PER_DAY + JD_UNIX_EPOCH;
  const d = jd - J2000_JD;
  return ((W0 + spinRate * d) % 360) * DEG_TO_RAD;
}
