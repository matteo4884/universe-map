const HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const KM_PER_UNIT = 6371;

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

function buildUrl(
  bodyId: string,
  startTime: string,
  stopTime: string,
  stepSize: string
): string {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${bodyId}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    START_TIME: `'${startTime}'`,
    STOP_TIME: `'${stopTime}'`,
    STEP_SIZE: `'${stepSize}'`,
    VEC_TABLE: "'2'",
    REF_PLANE: "'ECLIPTIC'",
    OUT_UNITS: "'KM-S'",
  });
  return `${HORIZONS_API}?${params.toString()}`;
}

function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function parseEphemerisPoints(result: string): EphemerisPoint[] {
  const soeIndex = result.indexOf("$$SOE");
  const eoeIndex = result.indexOf("$$EOE");
  if (soeIndex === -1 || eoeIndex === -1) return [];

  const dataBlock = result.slice(soeIndex + 5, eoeIndex);
  const regex =
    /X\s*=\s*([-\d.E+]+)\s*Y\s*=\s*([-\d.E+]+)\s*Z\s*=\s*([-\d.E+]+)/g;

  const points: EphemerisPoint[] = [];
  let match;
  while ((match = regex.exec(dataBlock)) !== null) {
    points.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      z: parseFloat(match[3]),
    });
  }
  return points;
}

async function fetchSingleBody(
  bodyId: string,
  startTime: string,
  stopTime: string,
  stepSize: string
): Promise<EphemerisPoint[] | null> {
  try {
    const url = buildUrl(bodyId, startTime, stopTime, stepSize);
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.error) return null;
    return parseEphemerisPoints(data.result);
  } catch {
    return null;
  }
}

export async function fetchEphemeris(
  bodyIds: string[],
  time?: Date
): Promise<EphemerisData> {
  const now = time || new Date();
  const startTime = formatDate(now);
  const end = new Date(now.getTime() + 60000);
  const stopTime = formatDate(end);

  const results = await Promise.allSettled(
    bodyIds.map((id) => fetchSingleBody(id, startTime, stopTime, "1m"))
  );

  const ephemeris: EphemerisData = {};
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value && result.value.length > 0) {
      ephemeris[bodyIds[i]] = result.value[0];
    }
  });

  return ephemeris;
}

export async function fetchTrajectories(
  bodyIds: string[],
  startTime: Date,
  endTime: Date,
  stepSize: string
): Promise<TrajectoryData> {
  const start = formatDate(startTime);
  const end = formatDate(endTime);

  const results = await Promise.allSettled(
    bodyIds.map((id) => fetchSingleBody(id, start, end, stepSize))
  );

  const trajectories: TrajectoryData = {};
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value && result.value.length > 0) {
      trajectories[bodyIds[i]] = result.value;
    }
  });

  return trajectories;
}

export function toThreeUnits(point: EphemerisPoint, scaleDistance: number): EphemerisPoint {
  return {
    x: point.x / KM_PER_UNIT / scaleDistance,
    y: point.y / KM_PER_UNIT / scaleDistance,
    z: point.z / KM_PER_UNIT / scaleDistance,
  };
}

export { KM_PER_UNIT };
