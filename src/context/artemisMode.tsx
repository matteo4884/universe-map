import { createContext, useState, useEffect, useRef, useCallback } from "react";
import { MissionConfig, getActiveMission } from "../config/missions";
import { fetchArtemisLive, interpolateSpacecraft, ArtemisPoint, ArtemisLiveData } from "../services/artemisLive";
import { EphemerisPoint } from "../services/horizons";

export interface Telemetry {
  distEarth: number;
  distMoon: number;
  velocity: number;
  altitude: number;
  met: number;
  phase: string;
}

export interface ArtemisModeContextType {
  mission: MissionConfig | null;
  active: boolean;
  activate: () => void;
  deactivate: () => void;
  position: ArtemisPoint | null;
  telemetry: Telemetry | null;
  trajectory: EphemerisPoint[];
  signalLost: boolean;
  earthOverride: EphemerisPoint | null;
  moonOverride: EphemerisPoint | null;
}

export const ArtemisModeContext = createContext<ArtemisModeContextType>({
  mission: null,
  active: false,
  activate: () => {},
  deactivate: () => {},
  position: null,
  telemetry: null,
  trajectory: [],
  signalLost: false,
  earthOverride: null,
  moonOverride: null,
});

const POLL_INTERVAL = 5 * 60 * 1000;
const EARTH_RADIUS_KM = 6371;

export function ArtemisModeProvider({ children }: { children: React.ReactNode }) {
  const mission = getActiveMission();
  const [active, setActive] = useState(false);
  const [signalLost, setSignalLost] = useState(false);
  const liveDataRef = useRef<ArtemisLiveData | null>(null);
  const [position, setPosition] = useState<ArtemisPoint | null>(null);
  const [trajectory, setTrajectory] = useState<EphemerisPoint[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [earthOverride, setEarthOverride] = useState<EphemerisPoint | null>(null);
  const [moonOverride, setMoonOverride] = useState<EphemerisPoint | null>(null);
  const intervalRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Check URL param on mount
  useEffect(() => {
    if (!mission) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(mission.queryParam) === "true") {
      setActive(true);
    }
  }, [mission]);

  const activate = useCallback(() => {
    if (!mission) return;
    setActive(true);
    const url = new URL(window.location.href);
    url.searchParams.set(mission.queryParam, "true");
    history.replaceState(null, "", url.toString());
  }, [mission]);

  const deactivate = useCallback(() => {
    if (!mission) return;
    setActive(false);
    setPosition(null);
    setTelemetry(null);
    setTrajectory([]);
    setEarthOverride(null);
    setMoonOverride(null);
    liveDataRef.current = null;
    const url = new URL(window.location.href);
    url.searchParams.delete(mission.queryParam);
    history.replaceState(null, "", url.toString());
  }, [mission]);

  // Polling artemis-live.json
  useEffect(() => {
    if (!active || !mission) return;

    async function poll() {
      const data = await fetchArtemisLive();
      if (data) {
        liveDataRef.current = data;
        setSignalLost(false);
        setEarthOverride(data.earth.now);
        setMoonOverride(data.moon.now);
      } else {
        setSignalLost(true);
      }
    }

    poll();
    intervalRef.current = window.setInterval(poll, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, mission]);

  // Interpolation loop (every frame)
  useEffect(() => {
    if (!active) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let lastTrajectoryPush = 0;

    function tick() {
      if (liveDataRef.current && mission) {
        const pos = interpolateSpacecraft(liveDataRef.current);
        setPosition(pos);

        const now = Date.now();
        if (now - lastTrajectoryPush > 30000) {
          setTrajectory((prev) => [...prev, { x: pos.x, y: pos.y, z: pos.z }]);
          lastTrajectoryPush = now;
        }

        const earth = liveDataRef.current.earth.now;
        const moon = liveDataRef.current.moon.now;

        const dx = pos.x - earth.x, dy = pos.y - earth.y, dz = pos.z - earth.z;
        const distEarth = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const mx = pos.x - moon.x, my = pos.y - moon.y, mz = pos.z - moon.z;
        const distMoon = Math.sqrt(mx * mx + my * my + mz * mz);

        const velocity = Math.sqrt((pos.vx ?? 0) ** 2 + (pos.vy ?? 0) ** 2 + (pos.vz ?? 0) ** 2);
        const altitude = distEarth - EARTH_RADIUS_KM;

        const met = (Date.now() - mission.startDate.getTime()) / 1000;
        let phase = mission.phases[0].name;
        for (const p of mission.phases) {
          if (met >= p.startMET) phase = p.name;
        }

        setTelemetry({ distEarth, distMoon, velocity, altitude, met, phase });
      }
      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [active, mission]);

  return (
    <ArtemisModeContext.Provider
      value={{
        mission, active, activate, deactivate, position, telemetry,
        trajectory, signalLost, earthOverride, moonOverride,
      }}
    >
      {children}
    </ArtemisModeContext.Provider>
  );
}
