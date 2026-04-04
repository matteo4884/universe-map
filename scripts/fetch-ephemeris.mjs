#!/usr/bin/env node

/**
 * Fetches ephemeris data from NASA JPL Horizons API and saves it
 * as a static JSON file for the frontend to consume.
 *
 * Usage: node scripts/fetch-ephemeris.mjs
 * Output: public/data/ephemeris.json
 */

const HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api";

// Each planet gets enough data for one full orbit with ~360 points
const BODIES = [
  // Planets: fetch one full orbital period with appropriate step sizes
  // orbitDays slightly less than one full period to avoid overlap
  { id: "199", name: "Mercury", type: "planet", orbitDays: 86, stepSize: "6h" },
  { id: "299", name: "Venus", type: "planet", orbitDays: 223, stepSize: "15h" },
  { id: "399", name: "Earth", type: "planet", orbitDays: 363, stepSize: "1d" },
  { id: "499", name: "Mars", type: "planet", orbitDays: 684, stepSize: "2d" },
  { id: "599", name: "Jupiter", type: "planet", orbitDays: 4320, stepSize: "12d" },
  { id: "699", name: "Saturn", type: "planet", orbitDays: 10740, stepSize: "30d" },
  { id: "799", name: "Uranus", type: "planet", orbitDays: 30600, stepSize: "85d" },
  { id: "899", name: "Neptune", type: "planet", orbitDays: 60100, stepSize: "167d" },
  // Moons: 1 month of data
  { id: "301", name: "Moon", type: "moon", orbitDays: 30, stepSize: "1d" },
  { id: "401", name: "Phobos", type: "moon", orbitDays: 2, stepSize: "1h" },
  { id: "402", name: "Deimos", type: "moon", orbitDays: 5, stepSize: "2h" },
  // Jupiter's moons
  { id: "501", name: "Io", type: "moon", orbitDays: 2, stepSize: "1h" },
  { id: "502", name: "Europa", type: "moon", orbitDays: 4, stepSize: "3h" },
  { id: "503", name: "Ganymede", type: "moon", orbitDays: 8, stepSize: "6h" },
  { id: "504", name: "Callisto", type: "moon", orbitDays: 17, stepSize: "12h" },
  // Saturn's moons
  { id: "606", name: "Titan", type: "moon", orbitDays: 16, stepSize: "12h" },
  { id: "602", name: "Enceladus", type: "moon", orbitDays: 2, stepSize: "1h" },
  { id: "601", name: "Mimas", type: "moon", orbitDays: 1, stepSize: "1h" },
  { id: "605", name: "Rhea", type: "moon", orbitDays: 5, stepSize: "4h" },
  { id: "608", name: "Iapetus", type: "moon", orbitDays: 80, stepSize: "2d" },
  // Uranus's moons
  { id: "705", name: "Miranda", type: "moon", orbitDays: 2, stepSize: "1h" },
  { id: "701", name: "Ariel", type: "moon", orbitDays: 3, stepSize: "2h" },
  { id: "702", name: "Umbriel", type: "moon", orbitDays: 5, stepSize: "4h" },
  { id: "703", name: "Titania", type: "moon", orbitDays: 9, stepSize: "7h" },
  { id: "704", name: "Oberon", type: "moon", orbitDays: 14, stepSize: "12h" },
  // Neptune's moon
  { id: "801", name: "Triton", type: "moon", orbitDays: 6, stepSize: "5h" },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(date) {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function buildUrl(bodyId, startTime, stopTime, stepSize) {
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

function parsePoints(result) {
  const soeIndex = result.indexOf("$$SOE");
  const eoeIndex = result.indexOf("$$EOE");
  if (soeIndex === -1 || eoeIndex === -1) return [];

  const dataBlock = result.slice(soeIndex + 5, eoeIndex);
  const regex =
    /X\s*=\s*([-\d.E+]+)\s*Y\s*=\s*([-\d.E+]+)\s*Z\s*=\s*([-\d.E+]+)/g;

  const points = [];
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

async function fetchBody(bodyId, startTime, stopTime, stepSize, retries = 5) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = buildUrl(bodyId, startTime, stopTime, stepSize);
      const response = await fetch(url);

      if (response.status === 503) {
        const waitTime = 3000 * (attempt + 1);
        console.log(`  503 for ${bodyId}, retrying in ${waitTime / 1000}s...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) {
        console.error(`  HTTP ${response.status} for ${bodyId}`);
        return null;
      }

      const data = await response.json();
      if (data.error) {
        console.error(`  API error for ${bodyId}: ${data.error}`);
        return null;
      }

      return parsePoints(data.result);
    } catch (err) {
      console.error(`  Fetch error for ${bodyId}: ${err.message}`);
      if (attempt < retries - 1) {
        await delay(3000 * (attempt + 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function main() {
  const now = new Date();

  console.log(`Fetching ephemeris data at ${now.toISOString()}`);
  console.log("---");

  // Fetch current positions
  const positions = {};
  const startTime = formatDate(now);
  const stopTime = formatDate(new Date(now.getTime() + 60000));

  console.log("Fetching current positions...");
  for (const body of BODIES) {
    process.stdout.write(`  ${body.name} (${body.id})...`);
    const points = await fetchBody(body.id, startTime, stopTime, "1m");
    if (points && points.length > 0) {
      positions[body.id] = points[0];
      console.log(` OK`);
    } else {
      console.log(" FAILED");
    }
    await delay(1500);
  }

  // Fetch trajectories — one full orbit per body
  const trajectories = {};

  console.log("\nFetching trajectories (1 full orbit each)...");
  for (const body of BODIES) {
    const orbitStart = new Date(
      now.getTime() - body.orbitDays * 24 * 60 * 60 * 1000
    );
    process.stdout.write(
      `  ${body.name} (${body.orbitDays}d, step=${body.stepSize})...`
    );
    const points = await fetchBody(
      body.id,
      formatDate(orbitStart),
      formatDate(now),
      body.stepSize
    );
    if (points && points.length > 0) {
      trajectories[body.id] = points;
      console.log(` OK (${points.length} points)`);
    } else {
      console.log(" FAILED");
    }
    await delay(2000);
  }

  // Build output
  const output = {
    fetchedAt: now.toISOString(),
    positions,
    trajectories,
  };

  const posCount = Object.keys(positions).length;
  const trajCount = Object.keys(trajectories).length;
  console.log(`\n--- Results ---`);
  console.log(`Positions: ${posCount}/${BODIES.length}`);
  console.log(`Trajectories: ${trajCount}/${BODIES.length}`);

  if (posCount === 0) {
    console.error("No positions fetched! Aborting.");
    process.exit(1);
  }

  // Write to file
  const fs = await import("fs");
  const path = await import("path");
  const outDir = path.join(process.cwd(), "public", "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "ephemeris.json");
  fs.writeFileSync(outFile, JSON.stringify(output));

  const sizeKB = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`\nSaved to ${outFile} (${sizeKB} KB)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
