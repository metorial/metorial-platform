export type Random = {
  next: () => number;
  int: (maxExclusive: number) => number;
  pick: <T>(items: readonly T[]) => T;
  bool: (probability?: number) => boolean;
};

export let createRandom = (seed: number): Random => {
  let state = seed >>> 0;

  let next = () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: maxExclusive => Math.floor(next() * maxExclusive),
    pick: items => items[Math.floor(next() * items.length)]!,
    bool: (probability = 0.5) => next() < probability
  };
};
