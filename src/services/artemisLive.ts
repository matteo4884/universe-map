// src/services/artemisLive.ts

export interface ArtemisPoint {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

export interface ArtemisLiveData {
  fetchedAt: string;
  spacecraft: { now: ArtemisPoint; ahead?: ArtemisPoint };
  earth: { now: ArtemisPoint; ahead?: ArtemisPoint };
  moon: { now: ArtemisPoint; ahead?: ArtemisPoint };
}

export async function fetchArtemisLive(): Promise<ArtemisLiveData | null> {
  try {
    const response = await fetch(`/data/artemis-live.json?t=${Date.now()}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function interpolateSpacecraft(data: ArtemisLiveData): ArtemisPoint {
  const { now, ahead } = data.spacecraft;
  if (!ahead) return now;

  const fetchedAt = new Date(data.fetchedAt).getTime();
  const aheadTime = fetchedAt + 10 * 60 * 1000;
  const t = Math.max(0, Math.min(1, (Date.now() - fetchedAt) / (aheadTime - fetchedAt)));

  return {
    x: now.x + (ahead.x - now.x) * t,
    y: now.y + (ahead.y - now.y) * t,
    z: now.z + (ahead.z - now.z) * t,
    vx: (now.vx ?? 0) + ((ahead.vx ?? 0) - (now.vx ?? 0)) * t,
    vy: (now.vy ?? 0) + ((ahead.vy ?? 0) - (now.vy ?? 0)) * t,
    vz: (now.vz ?? 0) + ((ahead.vz ?? 0) - (now.vz ?? 0)) * t,
  };
}
