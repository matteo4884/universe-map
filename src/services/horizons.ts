export const KM_PER_UNIT = 6371;

export interface EphemerisPoint {
  x: number;
  y: number;
  z: number;
}

export interface EphemerisData {
  [horizonsId: string]: EphemerisPoint;
}

export interface TrajectoryData {
  [horizonsId: string]: EphemerisPoint[];
}

interface EphemerisFile {
  fetchedAt: string;
  positions: EphemerisData;
  trajectories: TrajectoryData;
}

export async function loadEphemeris(): Promise<EphemerisFile | null> {
  try {
    const response = await fetch("/data/ephemeris.json");
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function toThreeUnits(
  point: EphemerisPoint,
  scaleDistance: number
): EphemerisPoint {
  return {
    x: point.x / KM_PER_UNIT / scaleDistance,
    y: point.y / KM_PER_UNIT / scaleDistance,
    z: point.z / KM_PER_UNIT / scaleDistance,
  };
}
