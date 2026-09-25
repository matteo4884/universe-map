#!/usr/bin/env node

/**
 * Fetches orbital data from NASA JPL Horizons and saves it as a static JSON
 * file for the frontend, which computes positions for any instant from it.
 *
 * - Planets, dwarf planets and moons: osculating Keplerian elements at "now".
 *   When `fitDays` spans at least one full orbit, the mean motion is replaced
 *   by the mean-longitude rate measured over that window: for moons it absorbs
 *   the precession caused by their planet's oblateness (Io: 0.4° after a year
 *   instead of 94°). Slow Sun-orbiting bodies keep the osculating rate, which is
 *   far better when the window covers only a fraction of the orbit.
 * - Spacecraft: position samples at a fixed step (their paths aren't ellipses).
 *
 * Usage: node scripts/fetch-ephemeris.mjs
 * Output: dist/data/orbits.json if dist exists (production), else public/data/orbits.json
 */

const HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const DAY_MS = 86400000;
const JD_UNIX_EPOCH = 2440587.5;
const TDB_MINUS_UTC_MS = 69184; // TT − UTC (32.184 s + 37 leap seconds)

// key = id the frontend looks up. Giant planets and Pluto use their system
// barycenter (the frontend offsets Earth and Pluto by their big moon).
const ORBITS = [
  { key: "199", name: "Mercury", command: "199", center: "500@10", fitDays: 365 },
  { key: "299", name: "Venus", command: "299", center: "500@10", fitDays: 365 },
  { key: "3", name: "Earth-Moon barycenter", command: "3", center: "500@10", fitDays: 365 },
  { key: "4", name: "Mars barycenter", command: "4", center: "500@10", fitDays: 365 },
  { key: "5", name: "Jupiter barycenter", command: "5", center: "500@10", fitDays: 365 },
  { key: "6", name: "Saturn barycenter", command: "6", center: "500@10", fitDays: 365 },
  { key: "7", name: "Uranus barycenter", command: "7", center: "500@10", fitDays: 365 },
  { key: "8", name: "Neptune barycenter", command: "8", center: "500@10", fitDays: 365 },
  { key: "9", name: "Pluto barycenter", command: "9", center: "500@10", fitDays: 365 },
  { key: "2000001", name: "Ceres", command: "2000001", center: "500@10", fitDays: 365 },
  // Moons, relative to their planet's center
  { key: "301", name: "Moon", command: "301", center: "500@399", fitDays: 30 },
  { key: "401", name: "Phobos", command: "401", center: "500@499", fitDays: 30 },
  { key: "402", name: "Deimos", command: "402", center: "500@499", fitDays: 30 },
  { key: "501", name: "Io", command: "501", center: "500@599", fitDays: 30 },
  { key: "502", name: "Europa", command: "502", center: "500@599", fitDays: 30 },
  { key: "503", name: "Ganymede", command: "503", center: "500@599", fitDays: 30 },
  { key: "504", name: "Callisto", command: "504", center: "500@599", fitDays: 30 },
  { key: "601", name: "Mimas", command: "601", center: "500@699", fitDays: 30 },
  { key: "602", name: "Enceladus", command: "602", center: "500@699", fitDays: 30 },
  { key: "605", name: "Rhea", command: "605", center: "500@699", fitDays: 30 },
  { key: "606", name: "Titan", command: "606", center: "500@699", fitDays: 30 },
  { key: "608", name: "Iapetus", command: "608", center: "500@699", fitDays: 160 },
  { key: "701", name: "Ariel", command: "701", center: "500@799", fitDays: 30 },
  { key: "702", name: "Umbriel", command: "702", center: "500@799", fitDays: 30 },
  { key: "703", name: "Titania", command: "703", center: "500@799", fitDays: 30 },
  { key: "704", name: "Oberon", command: "704", center: "500@799", fitDays: 30 },
  { key: "705", name: "Miranda", command: "705", center: "500@799", fitDays: 30 },
  { key: "801", name: "Triton", command: "801", center: "500@899", fitDays: 30 },
  { key: "901", name: "Charon", command: "901", center: "500@999", fitDays: 30 },
];

// Spacecraft: sampled from shortly after launch to `yearsAhead` into the
// future (or the end of the predicted ephemeris, `maxStop`)
const TRAJECTORIES = [
  { key: "-31", name: "Voyager 1", command: "-31", center: "500@10", start: "1977-09-06", stepDays: 20, yearsAhead: 10 },
  { key: "-32", name: "Voyager 2", command: "-32", center: "500@10", start: "1977-08-21", stepDays: 20, yearsAhead: 10 },
  { key: "-98", name: "New Horizons", command: "-98", center: "500@10", start: "2006-01-20", stepDays: 20, yearsAhead: 10 },
  { key: "-170", name: "James Webb Space Telescope", command: "-170", center: "500@399", start: "2021-12-26", stepDays: 3, yearsAhead: 5, maxStop: "2031-09-20" },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(date) {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function jdToUnixMs(jdTdb) {
  return (jdTdb - JD_UNIX_EPOCH) * DAY_MS - TDB_MINUS_UTC_MS;
}

function buildUrl({ command, center, type, start, stop, step }) {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: `'${type}'`,
    CENTER: `'${center}'`,
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`,
    VEC_TABLE: "'2'",
    REF_PLANE: "'ECLIPTIC'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
  });
  return `${HORIZONS_API}?${params.toString()}`;
}

/** Rows between $$SOE and $$EOE, split into CSV fields */
function parseRows(result) {
  const soe = result.indexOf("$$SOE");
  const eoe = result.indexOf("$$EOE");
  if (soe === -1 || eoe === -1) return [];
  return result
    .slice(soe + 5, eoe)
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((f) => f.trim()));
}

async function query(params, retries = 5) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(buildUrl(params));
      if (response.status === 503) {
        const wait = 3000 * (attempt + 1);
        console.log(`  503, retrying in ${wait / 1000}s...`);
        await delay(wait);
        continue;
      }
      if (!response.ok) {
        console.error(`  HTTP ${response.status}`);
        return null;
      }
      const data = await response.json();
      if (data.error) {
        console.error(`  API error: ${data.error.split("\n")[0]}`);
        return null;
      }
      const rows = parseRows(data.result);
      return rows.length > 0 ? rows : null;
    } catch (err) {
      console.error(`  Fetch error: ${err.message}`);
      if (attempt < retries - 1) await delay(3000 * (attempt + 1));
    }
  }
  return null;
}

const wrap360 = (deg) => ((deg % 360) + 360) % 360;

/**
 * Elements at `now`, with the mean motion fitted between two epochs `fitDays`
 * apart when that spans a full orbit. Columns: JDTDB, Cal, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
 */
async function fetchElements(body, now) {
  const start = new Date(now.getTime() - body.fitDays * DAY_MS);
  const rows = await query({
    command: body.command,
    center: body.center,
    type: "ELEMENTS",
    start: formatDate(start),
    stop: formatDate(now),
    step: `${body.fitDays}d`,
  });
  if (!rows || rows.length < 2) return null;

  const parse = (row) => ({
    jd: parseFloat(row[0]),
    e: parseFloat(row[2]),
    i: parseFloat(row[4]),
    om: parseFloat(row[5]),
    w: parseFloat(row[6]),
    n: parseFloat(row[8]) * 86400, // deg/s → deg/day
    ma: parseFloat(row[9]),
    a: parseFloat(row[11]),
  });
  const first = parse(rows[0]);
  const last = parse(rows[rows.length - 1]);
  if (!(last.e < 1)) return null; // not a bound orbit

  // Mean longitude change, with the whole turns resolved from the osculating rate
  const dtDays = last.jd - first.jd;
  const periodDays = 360 / last.n;
  let n = last.n;
  if (dtDays >= periodDays) {
    const lambda = (el) => el.om + el.w + el.ma;
    let dLambda = wrap360(lambda(last) - lambda(first));
    if (dLambda > 180) dLambda -= 360;
    const turns = Math.round((last.n * dtDays - dLambda) / 360);
    n = (dLambda + 360 * turns) / dtDays;
  }

  return {
    epoch: Math.round(jdToUnixMs(last.jd)),
    a: last.a,
    e: last.e,
    i: last.i,
    om: last.om,
    w: last.w,
    ma: last.ma,
    n,
  };
}

/** Position samples (km) at a fixed step. Columns: JDTDB, Cal, X, Y, Z, VX, VY, VZ */
async function fetchTrajectory(craft, now) {
  let stop = new Date(now.getTime() + craft.yearsAhead * 365.25 * DAY_MS);
  if (craft.maxStop && stop > new Date(craft.maxStop)) stop = new Date(craft.maxStop);
  const rows = await query({
    command: craft.command,
    center: craft.center,
    type: "VECTORS",
    start: craft.start,
    stop: formatDate(stop),
    step: `${craft.stepDays}d`,
  });
  if (!rows) return null;
  return {
    start: Math.round(jdToUnixMs(parseFloat(rows[0][0]))),
    stepDays: craft.stepDays,
    points: rows.map((row) => [
      Math.round(parseFloat(row[2])),
      Math.round(parseFloat(row[3])),
      Math.round(parseFloat(row[4])),
    ]),
  };
}

async function main() {
  const now = new Date();
  console.log(`Fetching orbital data at ${now.toISOString()}\n`);

  const elements = {};
  console.log("Orbital elements...");
  for (const body of ORBITS) {
    process.stdout.write(`  ${body.name} (${body.command})...`);
    const el = await fetchElements(body, now);
    if (el) {
      elements[body.key] = el;
      console.log(" OK");
    } else {
      console.log(" FAILED");
    }
    await delay(1500);
  }

  const trajectories = {};
  console.log("\nSpacecraft trajectories...");
  for (const craft of TRAJECTORIES) {
    process.stdout.write(`  ${craft.name} (${craft.command})...`);
    const traj = await fetchTrajectory(craft, now);
    if (traj) {
      trajectories[craft.key] = traj;
      console.log(` OK (${traj.points.length} points)`);
    } else {
      console.log(" FAILED");
    }
    await delay(2000);
  }

  if (Object.keys(elements).length === 0) {
    console.error("No orbital elements fetched! Aborting.");
    process.exit(1);
  }

  const fs = await import("fs");
  const path = await import("path");

  // dist/data in production, public/data in development
  const distDir = path.join(process.cwd(), "dist", "data");
  const publicDir = path.join(process.cwd(), "public", "data");
  const outDir = fs.existsSync(distDir) ? distDir : publicDir;
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "orbits.json");

  // Bodies that failed today keep the previous data instead of disappearing
  const missing = [
    ...ORBITS.filter((b) => !elements[b.key]).map((b) => ["elements", b]),
    ...TRAJECTORIES.filter((c) => !trajectories[c.key]).map((c) => ["trajectories", c]),
  ];
  if (missing.length > 0 && fs.existsSync(outFile)) {
    try {
      const previous = JSON.parse(fs.readFileSync(outFile, "utf8"));
      const kept = [];
      for (const [group, body] of missing) {
        const old = previous[group]?.[body.key];
        if (!old) continue;
        (group === "elements" ? elements : trajectories)[body.key] = old;
        kept.push(body.name);
      }
      if (kept.length > 0) console.log(`\nKept previous data for: ${kept.join(", ")}`);
    } catch (err) {
      console.error(`Could not read previous ${outFile}: ${err.message}`);
    }
  }

  const output = { fetchedAt: now.toISOString(), elements, trajectories };

  console.log(`\n--- Results ---`);
  console.log(`Elements: ${Object.keys(elements).length}/${ORBITS.length}`);
  console.log(`Trajectories: ${Object.keys(trajectories).length}/${TRAJECTORIES.length}`);

  // Temp file + rename: a client loading the page mid-write never gets a truncated JSON
  const tmpFile = `${outFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(output));
  fs.renameSync(tmpFile, outFile);

  const sizeKB = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`\nSaved to ${outFile} (${sizeKB} KB)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
