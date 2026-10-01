/**
 * Seeded pseudo-random numbers (mulberry32): the galaxy, the sky and the
 * asteroid belt come out the same on every visit.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample (Box–Muller) */
export function gaussian(random: () => number): number {
  const u = random() || 1e-12;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}
