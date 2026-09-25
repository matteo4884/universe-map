/** Simulated seconds per real second, slowest first */
export const SPEEDS = [
  { rate: 1, label: "Real time" },
  { rate: 60, label: "1 min/s" },
  { rate: 3600, label: "1 hour/s" },
  { rate: 86400, label: "1 day/s" },
  { rate: 604800, label: "1 week/s" },
  { rate: 2629800, label: "1 month/s" },
  { rate: 31557600, label: "1 year/s" },
];

export function speedIndex(rate: number): number {
  const abs = Math.abs(rate);
  let best = 0;
  SPEEDS.forEach((s, i) => {
    if (Math.abs(Math.log(s.rate) - Math.log(abs)) < Math.abs(Math.log(SPEEDS[best].rate) - Math.log(abs))) best = i;
  });
  return best;
}

/** Faster/slower along the speed ladder, keeping the direction */
export function stepSpeed(rate: number, step: 1 | -1): number {
  const i = Math.min(Math.max(speedIndex(rate) + step, 0), SPEEDS.length - 1);
  return SPEEDS[i].rate * (rate < 0 ? -1 : 1);
}
