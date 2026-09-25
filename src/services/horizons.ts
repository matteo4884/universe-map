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

