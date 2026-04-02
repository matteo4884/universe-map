import { useState, useEffect, useRef } from "react";
import {
  fetchEphemeris,
  fetchTrajectories,
  EphemerisData,
  TrajectoryData,
} from "../services/horizons";
import { SOLAR_SYSTEM, CelestialBody } from "../data";

export interface UseEphemerisResult {
  positions: EphemerisData | null;
  trajectories: TrajectoryData | null;
  loading: boolean;
  error: boolean;
}

function collectHorizonsIds(body: CelestialBody): string[] {
  const ids = [body.horizonsId];
  for (const child of body.children) {
    ids.push(...collectHorizonsIds(child));
  }
  return ids;
}

function getPlanetIds(): string[] {
  return SOLAR_SYSTEM.children.map((p) => p.horizonsId);
}

function getMoonIds(): string[] {
  const ids: string[] = [];
  for (const planet of SOLAR_SYSTEM.children) {
    for (const moon of planet.children) {
      ids.push(moon.horizonsId);
    }
  }
  return ids;
}

const REFRESH_INTERVAL = 30 * 60 * 1000;

export function useEphemeris(): UseEphemerisResult {
  const [positions, setPositions] = useState<EphemerisData | null>(null);
  const [trajectories, setTrajectories] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const allIds = collectHorizonsIds(SOLAR_SYSTEM);
      const planetIds = getPlanetIds();
      const moonIds = getMoonIds();

      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      try {
        const [posResult, planetTrajResult, moonTrajResult] = await Promise.all([
          fetchEphemeris(allIds),
          fetchTrajectories(planetIds, oneYearAgo, now, "1d"),
          fetchTrajectories(moonIds, oneMonthAgo, now, "1d"),
        ]);

        if (cancelled) return;

        const hasPositions = Object.keys(posResult).length > 0;
        if (hasPositions) {
          setPositions(posResult);
          setTrajectories({ ...planetTrajResult, ...moonTrajResult });
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();

    intervalRef.current = window.setInterval(async () => {
      const allIds = collectHorizonsIds(SOLAR_SYSTEM);
      try {
        const newPositions = await fetchEphemeris(allIds);
        if (Object.keys(newPositions).length > 0) {
          setPositions(newPositions);
        }
      } catch {
        // Keep last valid positions
      }
    }, REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { positions, trajectories, loading, error };
}
