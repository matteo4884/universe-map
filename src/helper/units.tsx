import * as THREE from "three";

export const KM_PER_UNIT = 6371; // 1 Three.js unit = 1 Earth radius in realistic mode
const LOG_POWER = 0.3;

// Realistic mode: direct km to units conversion
export function kmToUnits(km: number): number {
  return km / KM_PER_UNIT;
}

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

// Radii in "easy" mode: real proportions preserved, small bodies boosted 3x
// Gas giants and Sun stay at real size (already big enough to see)
export function logScaleRadius(radiusKm: number): number {
  if (radiusKm <= 0) return 0;
  const realUnits = radiusKm / KM_PER_UNIT;
  if (realUnits > 5) return realUnits; // Sun, Jupiter, Saturn: no boost needed
  return Math.max(realUnits * 3, 0.5); // Boost 3x, min 0.5 units
}

// Log scale for moon-relative distances (lower power to keep moons close to parent)
const LOG_POWER_MOON = 0.2;

export function logScaleMoonPosition(
  relX: number,
  relY: number,
  relZ: number
): [number, number, number] {
  const d = Math.sqrt(relX * relX + relY * relY + relZ * relZ);
  if (d === 0) return [0, 0, 0];
  const dLog = Math.pow(d, LOG_POWER_MOON);
  return [(relX / d) * dLog, (relY / d) * dLog, (relZ / d) * dLog];
}

// Blended moon position: lerp between log-moon and realistic
export function blendMoonPosition(
  relX: number,
  relY: number,
  relZ: number,
  blend: number
): [number, number, number] {
  const logPos = logScaleMoonPosition(relX, relY, relZ);
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
 * Convert a planet's north-pole RA/Dec (equatorial J2000, degrees)
 * into a Three.js Quaternion that orients a sphere whose default
 * poles are along ±Y so that its north pole points in the correct
 * ecliptic direction (matching the Horizons coordinate system).
 */
export function poleToQuaternion(
  poleRADeg: number,
  poleDecDeg: number
): THREE.Quaternion {
  const ra = poleRADeg * (Math.PI / 180);
  const dec = poleDecDeg * (Math.PI / 180);

  // Unit vector in equatorial J2000
  const xEq = Math.cos(dec) * Math.cos(ra);
  const yEq = Math.cos(dec) * Math.sin(ra);
  const zEq = Math.sin(dec);

  // Rotate to ecliptic (rotate around X-axis by +obliquity)
  const xEcl = xEq;
  const yEcl = yEq * COS_OBL + zEq * SIN_OBL;
  const zEcl = -yEq * SIN_OBL + zEq * COS_OBL;

  const targetPole = new THREE.Vector3(xEcl, yEcl, zEcl).normalize();

  return new THREE.Quaternion().setFromUnitVectors(_defaultPole, targetPole);
}
