import { OrbitalElements, Vec3 } from "../helper/kepler";

/** Spacecraft positions (km) sampled every `stepDays` from `start` */
export interface Trajectory {
  start: number; // ms since Unix epoch (UTC)
  stepDays: number;
  points: Vec3[];
}

export interface OrbitsData {
  fetchedAt: string;
  elements: Record<string, OrbitalElements>;
  trajectories: Record<string, Trajectory>;
}

export async function loadOrbits(): Promise<OrbitsData | null> {
  try {
    const response = await fetch("/data/orbits.json");
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
