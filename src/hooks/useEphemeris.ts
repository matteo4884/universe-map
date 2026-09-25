import { useState, useEffect } from "react";
import { loadOrbits } from "../services/orbits";
import { createEphemeris } from "../helper/ephemeris";
import { EphemerisContextType } from "../context/contexts";

/** Loads orbits.json once and builds the position model */
export function useEphemeris(): EphemerisContextType {
  const [state, setState] = useState<EphemerisContextType>({
    ephemeris: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;
    loadOrbits().then((data) => {
      if (cancelled) return;
      if (data && Object.keys(data.elements).length > 0) {
        setState({ ephemeris: createEphemeris(data), loading: false, error: false });
      } else {
        console.warn("[Ephemeris] orbits.json unavailable, using fallback positions");
        setState({ ephemeris: null, loading: false, error: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
