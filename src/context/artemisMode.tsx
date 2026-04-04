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

export type ArtemisCameraTarget = "orion" | "earth" | "moon" | null;

export interface ArtemisModeContextType {
  mission: MissionConfig | null;
  active: boolean;
  activate: () => void;
  deactivate: () => void;
  position: ArtemisPoint | null;
  telemetry: Telemetry | null;
  fetchedAt: string | null;
  dataOnline: boolean;
  earthOverride: EphemerisPoint | null;
  moonOverride: EphemerisPoint | null;
  cameraTarget: ArtemisCameraTarget;
  setCameraTarget: (target: ArtemisCameraTarget) => void;
  orionEnhanced: boolean;
  setOrionEnhanced: (v: boolean) => void;
  cameraLocked: ArtemisCameraTarget;
  setCameraLocked: (body: ArtemisCameraTarget) => void;
}

export const ArtemisModeContext = createContext<ArtemisModeContextType>({
  mission: null,
  active: false,
  activate: () => {},
  deactivate: () => {},
  position: null,
  telemetry: null,
  fetchedAt: null,
  dataOnline: false,
  earthOverride: null,
  moonOverride: null,
  cameraTarget: null,
  setCameraTarget: () => {},
  orionEnhanced: false,
  setOrionEnhanced: () => {},
  cameraLocked: null,
  setCameraLocked: () => {},
});

const POLL_INTERVAL = 5 * 60 * 1000;
const STALE_THRESHOLD = 10 * 60 * 1000;
const EARTH_RADIUS_KM = 6371;

/** Interpolate a body between now and ahead based on wall clock */
function interpolateBody(data: ArtemisLiveData, key: "earth" | "moon"): EphemerisPoint {
  const body = data[key];
  if (!body.ahead) return body.now;
  const fetchedAt = new Date(data.fetchedAt).getTime();
  const aheadTime = fetchedAt + 10 * 60 * 1000;
  const t = Math.max(0, Math.min(1, (Date.now() - fetchedAt) / (aheadTime - fetchedAt)));
  return {
    x: body.now.x + (body.ahead.x - body.now.x) * t,
    y: body.now.y + (body.ahead.y - body.now.y) * t,
    z: body.now.z + (body.ahead.z - body.now.z) * t,
  };
}

export function ArtemisModeProvider({ children }: { children: React.ReactNode }) {
  const mission = getActiveMission();
  const [active, setActive] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [dataOnline, setDataOnline] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<ArtemisCameraTarget>(null);
  const [orionEnhanced, setOrionEnhanced] = useState(true);
  const [cameraLocked, setCameraLocked] = useState<ArtemisCameraTarget>(null);
  const liveDataRef = useRef<ArtemisLiveData | null>(null);
  const [position, setPosition] = useState<ArtemisPoint | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [earthOverride, setEarthOverride] = useState<EphemerisPoint | null>(null);
  const [moonOverride, setMoonOverride] = useState<EphemerisPoint | null>(null);
  const intervalRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastUIUpdateRef = useRef<number>(0);

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
    setEarthOverride(null);
    setMoonOverride(null);
    setCameraLocked(null);
    liveDataRef.current = null;
    const url = new URL(window.location.href);
    url.searchParams.delete(mission.queryParam);
    history.replaceState(null, "", url.toString());
  }, [mission]);

  // Polling artemis-live.json
  useEffect(() => {
    if (!active || !mission) return;

    // Auto-deactivate if mission has ended
    if (Date.now() > mission.endDate.getTime()) {
      deactivate();
      return;
    }

    async function poll() {
      const data = await fetchArtemisLive();
      if (data) {
        liveDataRef.current = data;
        setFetchedAt(data.fetchedAt);
      }
    }

    poll();
    intervalRef.current = window.setInterval(poll, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, mission, deactivate]);

  // Update online status every second
  useEffect(() => {
    if (!active) return;
    function checkOnline() {
      if (!fetchedAt) {
        setDataOnline(false);
        return;
      }
      const age = Date.now() - new Date(fetchedAt).getTime();
      setDataOnline(age < STALE_THRESHOLD);
    }
    checkOnline();
    const id = window.setInterval(checkOnline, 1000);
    return () => clearInterval(id);
  }, [active, fetchedAt]);

  // Interpolation loop — ALL 3 bodies interpolated every frame
  useEffect(() => {
    if (!active) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    function tick() {
      if (liveDataRef.current && mission) {
        // Always update position for smooth 3D rendering
        const pos = interpolateSpacecraft(liveDataRef.current);
        setPosition(pos);

        // Throttle UI-only updates to 1/sec
        const now = Date.now();
        if (now - lastUIUpdateRef.current > 1000) {
          lastUIUpdateRef.current = now;

          // Interpolate Earth and Moon — only needed for HUD display
          const earthPos = interpolateBody(liveDataRef.current, "earth");
          const moonPos = interpolateBody(liveDataRef.current, "moon");
          setEarthOverride(earthPos);
          setMoonOverride(moonPos);

          // Telemetry from interpolated positions
          const dx = pos.x - earthPos.x, dy = pos.y - earthPos.y, dz = pos.z - earthPos.z;
          const distEarth = Math.sqrt(dx * dx + dy * dy + dz * dz);

          const mx = pos.x - moonPos.x, my = pos.y - moonPos.y, mz = pos.z - moonPos.z;
          const distMoon = Math.sqrt(mx * mx + my * my + mz * mz);

          const velocity = Math.sqrt((pos.vx ?? 0) ** 2 + (pos.vy ?? 0) ** 2 + (pos.vz ?? 0) ** 2);
          const altitude = distEarth - EARTH_RADIUS_KM;

          const met = (now - mission.startDate.getTime()) / 1000;
          let phase = mission.phases[0].name;
          for (const p of mission.phases) {
            if (met >= p.startMET) phase = p.name;
          }

          setTelemetry({ distEarth, distMoon, velocity, altitude, met, phase });
        }
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
        fetchedAt, dataOnline, earthOverride, moonOverride,
        cameraTarget, setCameraTarget,
        orionEnhanced, setOrionEnhanced,
        cameraLocked, setCameraLocked,
      }}
    >
      {children}
    </ArtemisModeContext.Provider>
  );
}
