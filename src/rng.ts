export type Rng = {
  next: () => number;
  int: (a: number, b: number) => number;
  chance: (p: number) => boolean;
  pick: <T>(arr: T[]) => T;
};

export function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)]!,
  };
}
