#!/usr/bin/env node
/**
 * Builds the reference data for src/__tests__/ephemeris.test.ts:
 * JPL Horizons state vectors at several instants around the epoch of
 * src/__tests__/fixtures/orbits.json. Rerun after refreshing that file.
 *
 * Usage: node scripts/fetch-test-fixture.mjs
 */
import fs from "fs";

const HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const DAY = 86400000;
const orbits = JSON.parse(fs.readFileSync("src/__tests__/fixtures/orbits.json", "utf8"));
const epoch = new Date(orbits.fetchedAt).getTime();

// [horizons id, center, label]
const TARGETS = [
  ["199", "500@10", "Mercury"], ["399", "500@10", "Earth"], ["599", "500@10", "Jupiter"],
  ["999", "500@10", "Pluto"], ["2000001", "500@10", "Ceres"],
  ["301", "500@399", "Moon"], ["501", "500@599", "Io"], ["601", "500@699", "Mimas"],
  ["606", "500@699", "Titan"], ["801", "500@899", "Triton"], ["901", "500@999", "Charon"],
  ["-31", "500@10", "Voyager 1"], ["-170", "500@399", "JWST"],
];
const OFFSETS_DAYS = [1 / 24, 1, 30, 365, -365, -5 * 365];

const fmt = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const samples = [];
for (const [id, center, label] of TARGETS) {
  for (const off of OFFSETS_DAYS) {
    const t = Math.round(epoch + off * DAY);
    const params = new URLSearchParams({
      format: "json", COMMAND: `'${id}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'",
      EPHEM_TYPE: "'VECTORS'", CENTER: `'${center}'`, TLIST: `'${fmt(t)}'`, TLIST_TYPE: "'CAL'",
      TIME_TYPE: "'UT'", VEC_TABLE: "'1'", REF_PLANE: "'ECLIPTIC'", OUT_UNITS: "'KM-S'", CSV_FORMAT: "'YES'",
    });
    const data = await (await fetch(`${HORIZONS_API}?${params}`)).json();
    const r = data.result ?? "";
    const soe = r.indexOf("$$SOE");
    if (soe < 0) { console.log(`skip ${label} ${off}d`); continue; }
    const row = r.slice(soe + 5, r.indexOf("$$EOE")).trim().split(",").map((f) => f.trim());
    samples.push({ id, label, t, pos: [parseFloat(row[2]), parseFloat(row[3]), parseFloat(row[4])] });
    process.stdout.write(".");
    await delay(700);
  }
}
fs.writeFileSync("src/__tests__/fixtures/horizons-vectors.json", JSON.stringify({ epoch: orbits.fetchedAt, samples }, null, 1));
console.log(`\n${samples.length} samples saved`);
