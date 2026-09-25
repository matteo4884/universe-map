import { Vec3, DAY_MS } from "./kepler";

const DEG = Math.PI / 180;
const JD_UNIX_EPOCH = 2440587.5;
const TT_MINUS_UTC_DAYS = 69.184 / 86400;
const EARTH_EQUATORIAL_RADIUS_KM = 6378.14;
// General precession in longitude per Julian century: ecliptic of date → J2000
const PRECESSION_DEG_PER_CENTURY = 1.396971;

/**
 * Geocentric Moon position (km, ecliptic J2000) from the Astronomical Almanac's
 * low-precision formulae. About 0.1° off at any date — unlike a Keplerian
 * orbit, which drifts by degrees within months because of the Sun's pull.
 */
export function moonPositionAnalytic(t: number): Vec3 {
  const jd = t / DAY_MS + JD_UNIX_EPOCH + TT_MINUS_UTC_DAYS;
  const T = (jd - 2451545.0) / 36525;
  const sin = (deg: number) => Math.sin(deg * DEG);
  const cos = (deg: number) => Math.cos(deg * DEG);

  const lambda =
    218.32 + 481267.881 * T +
    6.29 * sin(135.0 + 477198.87 * T) -
    1.27 * sin(259.3 - 413335.36 * T) +
    0.66 * sin(235.7 + 890534.22 * T) +
    0.21 * sin(269.9 + 954397.74 * T) -
    0.19 * sin(357.5 + 35999.05 * T) -
    0.11 * sin(186.5 + 966404.03 * T) -
    PRECESSION_DEG_PER_CENTURY * T;

  const beta =
    5.13 * sin(93.3 + 483202.02 * T) +
    0.28 * sin(228.2 + 960400.89 * T) -
    0.28 * sin(318.3 + 6003.15 * T) -
    0.17 * sin(217.6 - 407332.21 * T);

  const parallax =
    0.9508 +
    0.0518 * cos(135.0 + 477198.87 * T) +
    0.0095 * cos(259.3 - 413335.36 * T) +
    0.0078 * cos(235.7 + 890534.22 * T) +
    0.0028 * cos(269.9 + 954397.74 * T);

  const r = EARTH_EQUATORIAL_RADIUS_KM / Math.sin(parallax * DEG);
  return [r * cos(beta) * cos(lambda), r * cos(beta) * sin(lambda), r * sin(beta)];
}
