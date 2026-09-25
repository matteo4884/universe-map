import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getActiveMission } from "../config/missions";
import { fetchArtemisLive, interpolateSpacecraft, ArtemisPoint, ArtemisLiveData } from "../services/artemisLive";
import { EphemerisPoint } from "../services/horizons";
import { ArtemisModeContext, ArtemisCameraTarget, Telemetry } from "./contexts";

const POLL_INTERVAL = 5 * 60 * 1000;
const STALE_THRESHOLD = 10 * 60 * 1000;
const UI_UPDATE_INTERVAL = 1000;
const EARTH_RADIUS_KM = 6371;

/** Interpolate a body between now and ahead based on wall clock */
function interpolateBody(data: ArtemisLiveData, key: "earth" | "moon"): ArtemisPoint | null {
  const body = data[key];
  if (!body) return null;
  if (!body.ahead) return body.now;
  const fetchedAt = new Date(data.fetchedAt).getTime();
  const aheadTime = fetchedAt + 10 * 60 * 1000;
  const t = Math.max(0, Math.min(1, (Date.now() - fetchedAt) / (aheadTime - fetchedAt)));
  return {
    x: body.now.x + (body.ahead.x - body.now.x) * t,
    y: body.now.y + (body.ahead.y - body.now.y) * t,
    z: body.now.z + (body.ahead.z - body.now.z) * t,
    vx: (body.now.vx ?? 0) + ((body.ahead.vx ?? 0) - (body.now.vx ?? 0)) * t,
    vy: (body.now.vy ?? 0) + ((body.ahead.vy ?? 0) - (body.now.vy ?? 0)) * t,
    vz: (body.now.vz ?? 0) + ((body.ahead.vz ?? 0) - (body.now.vz ?? 0)) * t,
  };
}

export function ArtemisModeProvider({ children }: { children: React.ReactNode }) {
  const mission = useMemo(() => getActiveMission(), []);
  const [active, setActive] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [dataOnline, setDataOnline] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<ArtemisCameraTarget>(null);
  const [orionEnhanced, setOrionEnhanced] = useState(true);
  const [cameraLocked, setCameraLocked] = useState<ArtemisCameraTarget>(null);
  const liveDataRef = useRef<ArtemisLiveData | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [earthOverride, setEarthOverride] = useState<EphemerisPoint | null>(null);
  const [moonOverride, setMoonOverride] = useState<EphemerisPoint | null>(null);

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
    setFetchedAt(null);
    setTelemetry(null);
    setEarthOverride(null);
    setMoonOverride(null);
    setCameraLocked(null);
    liveDataRef.current = null;
    const url = new URL(window.location.href);
    url.searchParams.delete(mission.queryParam);
    history.replaceState(null, "", url.toString());
  }, [mission]);

  // The spacecraft moves every frame: 3D components pull its position
  // in useFrame instead of receiving it through React state
  const getSpacecraftPosition = useCallback(
    () => (liveDataRef.current ? interpolateSpacecraft(liveDataRef.current) : null),
    []
  );

  // HUD-only values (Earth/Moon positions, telemetry, online status) — 1/sec
  const updateUI = useCallback(() => {
    const data = liveDataRef.current;
    if (!data || !mission) {
      setDataOnline(false);
      return;
    }
    setDataOnline(Date.now() - new Date(data.fetchedAt).getTime() < STALE_THRESHOLD);

    const pos = interpolateSpacecraft(data);
    const earthPos = interpolateBody(data, "earth");
    const moonPos = interpolateBody(data, "moon");
    if (!earthPos || !moonPos) return;
    setEarthOverride(earthPos);
    setMoonOverride(moonPos);

    const dx = pos.x - earthPos.x, dy = pos.y - earthPos.y, dz = pos.z - earthPos.z;
    const distEarth = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const mx = pos.x - moonPos.x, my = pos.y - moonPos.y, mz = pos.z - moonPos.z;
    const distMoon = Math.sqrt(mx * mx + my * my + mz * mz);

    // Velocity relative to Earth (subtract Earth's heliocentric velocity)
    const relVx = (pos.vx ?? 0) - (earthPos.vx ?? 0);
    const relVy = (pos.vy ?? 0) - (earthPos.vy ?? 0);
    const relVz = (pos.vz ?? 0) - (earthPos.vz ?? 0);
    const velocity = Math.sqrt(relVx ** 2 + relVy ** 2 + relVz ** 2);
    const altitude = distEarth - EARTH_RADIUS_KM;

    const met = (Date.now() - mission.startDate.getTime()) / 1000;
    let phase = mission.phases[0].name;
    for (const p of mission.phases) {
      if (met >= p.startMET) phase = p.name;
    }

    setTelemetry({ distEarth, distMoon, velocity, altitude, met, phase });
  }, [mission]);

  // Polling artemis-live.json
  useEffect(() => {
    if (!active || !mission) return;

    // Auto-deactivate if mission has ended
    if (Date.now() > mission.endDate.getTime()) {
      deactivate();
      return;
    }

    let cancelled = false;
    async function poll() {
      const data = await fetchArtemisLive();
      if (data && !cancelled) {
        liveDataRef.current = data;
        setFetchedAt(data.fetchedAt);
        updateUI();
      }
    }

    poll();
    const pollId = window.setInterval(poll, POLL_INTERVAL);
    const uiId = window.setInterval(updateUI, UI_UPDATE_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(pollId);
      clearInterval(uiId);
    };
  }, [active, mission, deactivate, updateUI]);

  const value = useMemo(
    () => ({
      mission, active, activate, deactivate,
      hasPosition: fetchedAt !== null,
      getSpacecraftPosition, telemetry,
      fetchedAt, dataOnline, earthOverride, moonOverride,
      cameraTarget, setCameraTarget,
      orionEnhanced, setOrionEnhanced,
      cameraLocked, setCameraLocked,
    }),
    [
      mission, active, activate, deactivate, getSpacecraftPosition, telemetry,
      fetchedAt, dataOnline, earthOverride, moonOverride,
      cameraTarget, orionEnhanced, cameraLocked,
    ]
  );

  return (
    <ArtemisModeContext.Provider value={value}>
      {children}
    </ArtemisModeContext.Provider>
  );
}
