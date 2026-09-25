import { CelestialBody, Stat } from "../data";
import { Ephemeris } from "./ephemeris";
import { Vec3 } from "./kepler";
import { getBodyBySlug } from "./bodies";

const AU_KM = 149597870.7;
const LIGHT_KM_S = 299792.458;

/** Headline facts under the body's name */
export function headlineFacts(body: CelestialBody): Stat[] {
  if (body.galaxy) {
    return [
      { label: "Diameter", value: body.galaxy.diameter },
      { label: "Mass", value: body.info.mass },
      { label: "Type", value: body.galaxy.kind },
    ];
  }
  if (body.region) return body.region.headline;
  if (body.mission) {
    return [
      { label: "Agency", value: body.mission.agency },
      { label: "Launched", value: body.mission.launched },
      { label: "Status", value: body.mission.status },
    ];
  }
  return [
    { label: "Radius", value: `${body.radius.toLocaleString("en-US")} km` },
    { label: "Mass", value: body.info.mass },
    { label: "Temp", value: `${body.info.temperature}°C` },
  ];
}

const moonCount = (body: CelestialBody) => body.children.filter((c) => c.type === "moon").length;

/** Stats grid of the card */
export function bodyStats(body: CelestialBody): Stat[] {
  if (body.galaxy) return body.galaxy.stats;
  if (body.region) return body.region.stats;
  if (body.mission) return body.mission.stats;
  const i = body.info;
  if (body.type === "moon") {
    return [
      { label: "Orbit", value: i.dayLength },
      { label: "Speed", value: `${i.orbitalSpeed} km/s` },
      { label: "Radius", value: `${body.radius.toLocaleString("en-US")} km` },
      { label: "Gravity", value: `${i.gravity} m/s²` },
      { label: "Eccentric.", value: String(i.eccentricity) },
      { label: "Mag. field", value: i.magneticField ? "Yes" : "No" },
    ];
  }
  return [
    { label: "Day", value: i.dayLength },
    { label: "Year", value: i.yearLength },
    body.type === "star"
      ? { label: "Planets", value: String(body.children.filter((c) => c.category !== "Dwarf planet" && c.type === "planet").length) }
      : { label: "Moons", value: String(moonCount(body)) },
    { label: "Gravity", value: `${i.gravity} m/s²` },
    { label: "Tilt", value: `${i.axialTilt}°` },
    { label: "Rings", value: i.rings ? "Yes" : "No" },
  ];
}

export function formatDistance(km: number): string {
  if (km < 1e6) return `${Math.round(km).toLocaleString("en-US")} km`;
  if (km < 0.1 * AU_KM) return `${(km / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })} million km`;
  return `${(km / AU_KM).toLocaleString("en-US", { maximumFractionDigits: 2 })} AU`;
}

export function formatLightTime(km: number): string {
  const s = km / LIGHT_KM_S;
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 0)} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${Math.round(s - m * 60)} s`;
  const h = Math.floor(m / 60);
  return `${h} h ${m - h * 60} min`;
}

const PHASES = [
  "New Moon", "Waxing crescent", "First quarter", "Waxing gibbous",
  "Full Moon", "Waning gibbous", "Last quarter", "Waning crescent",
];

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Facts computed from the ephemeris at the simulated time */
export function liveFacts(body: CelestialBody, eph: Ephemeris, t: number): Stat[] {
  if (body.type === "galaxy" || body.type === "region") return [];
  const facts: Stat[] = [];
  const earth = getBodyBySlug("earth")!;
  const helio = eph.heliocentric(body, t);
  const earthPos = eph.heliocentric(earth, t);
  if (!helio) return [{ label: "Status", value: "Not launched yet" }];

  if (body.type === "moon") {
    const rel = eph.relative(body, t);
    if (rel) facts.push({ label: "From its planet", value: formatDistance(Math.hypot(...rel)) });
  } else if (body.type !== "star") {
    facts.push({ label: "From the Sun", value: formatDistance(Math.hypot(...helio)) });
  }

  if (earthPos && body.id !== earth.id) {
    const d = dist(helio, earthPos);
    facts.push({ label: "From Earth", value: formatDistance(d) });
    facts.push({ label: body.type === "spacecraft" ? "Signal delay" : "Light from it takes", value: formatLightTime(d) });
  }

  if (body.map === "moon" && earthPos) {
    // Elongation of the Moon from the Sun, seen from Earth
    const moonRel = eph.relative(body, t)!;
    const sunLon = Math.atan2(-earthPos[1], -earthPos[0]);
    const moonLon = Math.atan2(moonRel[1], moonRel[0]);
    const elong = ((((moonLon - sunLon) * 180) / Math.PI) % 360 + 360) % 360;
    const illuminated = (1 - Math.cos((elong * Math.PI) / 180)) / 2;
    facts.push({ label: "Phase", value: `${PHASES[Math.round(elong / 45) % 8]} · ${Math.round(illuminated * 100)}% lit` });
  }
  return facts;
}
