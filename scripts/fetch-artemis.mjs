#!/usr/bin/env node

/**
 * Fetches live Artemis + Earth + Moon positions from JPL Horizons.
 * Run via cron every 5 minutes during the mission:
 *   */5 * * * * node /path/to/scripts/fetch-artemis.mjs
 *
 * Output: public/data/artemis-live.json
 */

const HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api";

const BODIES = [
  { id: "-1024", key: "spacecraft", needVelocity: true },
  { id: "399", key: "earth", needVelocity: false },
  { id: "301", key: "moon", needVelocity: false },
];

function formatDate(date) {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function buildUrl(bodyId, startTime, stopTime) {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${bodyId}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    START_TIME: `'${startTime}'`,
    STOP_TIME: `'${stopTime}'`,
    STEP_SIZE: "'10m'",
    VEC_TABLE: "'2'",
    REF_PLANE: "'ECLIPTIC'",
    REF_SYSTEM: "'ICRF'",
    OUT_UNITS: "'KM-S'",
  });
  return `${HORIZONS_API}?${params.toString()}`;
}

const POS_RE = /X\s*=\s*([-\d.E+]+)\s*Y\s*=\s*([-\d.E+]+)\s*Z\s*=\s*([-\d.E+]+)/g;
const VEL_RE = /VX\s*=\s*([-\d.E+]+)\s*VY\s*=\s*([-\d.E+]+)\s*VZ\s*=\s*([-\d.E+]+)/g;

function parseResponse(result, needVelocity) {
  const soe = result.indexOf("$$SOE");
  const eoe = result.indexOf("$$EOE");
  if (soe === -1 || eoe === -1) return null;

  const block = result.slice(soe, eoe);
  const positions = [...block.matchAll(POS_RE)];
  if (positions.length < 1) return null;

  const makePoint = (pi, vi) => {
    const point = {
      x: parseFloat(pi[1]),
      y: parseFloat(pi[2]),
      z: parseFloat(pi[3]),
    };
    if (needVelocity && vi) {
      point.vx = parseFloat(vi[1]);
      point.vy = parseFloat(vi[2]);
      point.vz = parseFloat(vi[3]);
    }
    return point;
  };

  const velocities = needVelocity ? [...block.matchAll(VEL_RE)] : [];

  if (positions.length >= 2) {
    return {
      now: makePoint(positions[0], velocities[0]),
      ahead: makePoint(positions[1], velocities[1]),
    };
  }
  return { now: makePoint(positions[0], velocities[0]) };
}

async function fetchBody(bodyId, startTime, stopTime) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = buildUrl(bodyId, startTime, stopTime);
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 503 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        return null;
      }
      const data = await response.json();
      if (data.error) return null;
      return data.result;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function main() {
  const now = new Date();
  const ahead = new Date(now.getTime() + 10 * 60 * 1000);
  const startTime = formatDate(now);
  const stopTime = formatDate(ahead);

  console.log(`[fetch-artemis] ${now.toISOString()}`);

  const results = await Promise.all(
    BODIES.map(async (body) => {
      const result = await fetchBody(body.id, startTime, stopTime);
      if (!result) {
        console.error(`  FAILED: ${body.key} (${body.id})`);
        return [body.key, null];
      }
      const parsed = parseResponse(result, body.needVelocity);
      console.log(`  OK: ${body.key}`);
      return [body.key, parsed];
    })
  );

  const output = { fetchedAt: now.toISOString() };
  for (const [key, data] of results) {
    if (data) output[key] = data;
  }

  if (!output.spacecraft) {
    console.error("  Spacecraft data missing — keeping previous file");
    process.exit(1);
  }

  const fs = await import("fs");
  const path = await import("path");
  const outFile = path.join(process.cwd(), "public", "data", "artemis-live.json");
  fs.writeFileSync(outFile, JSON.stringify(output));
  console.log(`  Saved to ${outFile}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
