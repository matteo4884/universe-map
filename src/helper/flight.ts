/**
 * Camera flight paths. A flight zooms out, travels and zooms back in so that
 * the picture moves at a steady pace whatever the distance: the "optimal" path
 * of van Wijk & Nuij (2003), the one d3-zoom uses. Distances here span many
 * orders of magnitude (galaxy ↔ planet), so the zoom is exponential: every
 * tenfold change of distance takes the same time.
 */

/** Trade-off between zooming out and panning (van Wijk & Nuij found ≈√2 best) */
export const FLIGHT_RHO = Math.SQRT2;

export type ZoomPath = {
  /** Length of the path: how much motion the viewer perceives */
  length: number;
  /**
   * At path position s ∈ [0, length]: how far the view center has travelled
   * (u, 0–1) and the camera's distance to it (w)
   */
  at(s: number): { u: number; w: number };
};

/**
 * @param w0 starting camera distance from the view center
 * @param w1 final camera distance
 * @param d distance between the two view centers
 */
export function zoomPath(w0: number, w1: number, d: number, rho = FLIGHT_RHO): ZoomPath {
  const rho2 = rho * rho;
  const rho4 = rho2 * rho2;

  // Same center: a pure exponential zoom
  if (d <= 1e-9 * Math.max(w0, w1)) {
    const k = Math.log(w1 / w0);
    const length = Math.abs(k) / rho;
    return {
      length,
      at: (s) => (length > 0 ? { u: s / length, w: w0 * Math.exp((k * s) / length) } : { u: 1, w: w1 }),
    };
  }

  const b0 = (w1 * w1 - w0 * w0 + rho4 * d * d) / (2 * w0 * rho2 * d);
  const b1 = (w1 * w1 - w0 * w0 - rho4 * d * d) / (2 * w1 * rho2 * d);
  // ln(√(b² + 1) − b) = −asinh(b), without the cancellation for large b
  const r0 = -Math.asinh(b0);
  const r1 = -Math.asinh(b1);
  const coshR0 = Math.cosh(r0);
  const sinhR0 = Math.sinh(r0);
  return {
    length: (r1 - r0) / rho,
    at(s) {
      const x = rho * s + r0;
      return {
        u: (w0 / (rho2 * d)) * (coshR0 * Math.tanh(x) - sinhR0),
        w: (w0 * coshR0) / Math.cosh(x),
      };
    },
  };
}

/** Farthest the camera gets from the view center along the path */
export function peakDistance(path: ZoomPath, w0: number, w1: number): number {
  let peak = Math.max(w0, w1);
  for (let i = 1; i < 16; i++) peak = Math.max(peak, path.at((path.length * i) / 16).w);
  return peak;
}

/**
 * Progress (0–1) at time fraction t: speeds up during the first `rampIn` of
 * the flight, cruises, and slows down during the last `rampOut`. The speed
 * follows half a cosine on each ramp, so it never jumps and the flight starts
 * and stops from rest.
 */
export function flightEase(t: number, rampIn: number, rampOut: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  const a = Math.min(Math.max(rampIn, 1e-6), 0.5);
  const b = Math.min(Math.max(rampOut, 1e-6), 0.5);
  const cruise = 1 / (1 - (a + b) / 2);
  if (x < a) return cruise * (x / 2 - (a / (2 * Math.PI)) * Math.sin((Math.PI * x) / a));
  if (x <= 1 - b) return cruise * (a / 2 + (x - a));
  const tau = x - (1 - b);
  return cruise * (a / 2 + (1 - a - b) + tau / 2 + (b / (2 * Math.PI)) * Math.sin((Math.PI * tau) / b));
}

const MIN_DURATION = 1.0; // s
const MAX_DURATION = 5.0;
const SECONDS_PER_LENGTH = 0.27;
// Ramp durations (s), shortened on quick flights
const RAMP_IN = 0.9;
const RAMP_OUT = 1.3;

/** Duration (s) and ramps of a flight along a path */
export function flightTiming(length: number, reducedMotion = false) {
  const duration = reducedMotion
    ? 0.6
    : Math.min(Math.max(MIN_DURATION + SECONDS_PER_LENGTH * length, MIN_DURATION), MAX_DURATION);
  return {
    duration,
    rampIn: Math.min(RAMP_IN / duration, 0.5),
    rampOut: Math.min(RAMP_OUT / duration, 0.5),
  };
}
