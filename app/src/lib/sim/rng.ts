// Small seeded random number generator so every simulation run is reproducible.

export type Rng = {
  next: () => number; // uniform [0, 1)
  normal: (mean?: number, sd?: number) => number;
  lognormal: (median: number, sigma: number) => number;
  pareto: (xmin: number, alpha: number) => number;
  poisson: (lambda: number) => number;
  int: (n: number) => number; // 0..n-1
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
  /** Fisher–Yates, in place. Never sort with a random comparator: engines differ. */
  shuffle: <T>(items: T[]) => T[];
};

export function createRng(seed: number): Rng {
  // mulberry32
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let spare: number | null = null;
  const standardNormal = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = next();
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };

  const rng: Rng = {
    next,
    normal: (mean = 0, sd = 1) => mean + sd * standardNormal(),
    lognormal: (median, sigma) => median * Math.exp(sigma * standardNormal()),
    pareto: (xmin, alpha) => xmin / Math.pow(1 - next(), 1 / alpha),
    poisson: (lambda) => {
      // Knuth; fine for the small lambdas used here.
      const l = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > l);
      return k - 1;
    },
    int: (n) => Math.floor(next() * n),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
  };
  return rng;
}
