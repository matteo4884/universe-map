import { useState, useEffect } from "react";
import { loadEphemeris, EphemerisData, TrajectoryData } from "../services/horizons";

export interface UseEphemerisResult {
  positions: EphemerisData | null;
  trajectories: TrajectoryData | null;
  loading: boolean;
  error: boolean;
  loadedAt: string | null;
}

export function useEphemeris(): UseEphemerisResult {
  const [positions, setPositions] = useState<EphemerisData | null>(null);
  const [trajectories, setTrajectories] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await loadEphemeris();

        if (cancelled) return;

        if (data && Object.keys(data.positions).length > 0) {
          setPositions(data.positions);
          setTrajectories(data.trajectories);
          setLoadedAt(data.fetchedAt);
          console.log(
            `[Ephemeris] Loaded ${Object.keys(data.positions).length} positions, ` +
            `${Object.keys(data.trajectories).length} trajectories ` +
            `(fetched at ${data.fetchedAt})`
          );
        } else {
          console.warn("[Ephemeris] No data in ephemeris.json, using fallback");
          setError(true);
        }
      } catch {
        if (!cancelled) {
          console.error("[Ephemeris] Failed to load ephemeris.json");
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { positions, trajectories, loading, error, loadedAt };
}
