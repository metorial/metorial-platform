import { createHash } from 'node:crypto';
import { createRandom, type Random } from '@mtsrc/agent-tracking-testing';

type Spread = { median: number; p90: number; min?: number; max?: number };

type Weighted<T> = { value: T; weight: number };

let z90 = 1.2815515655446004;

export type Sampler = Random & {
  normal: () => number;
  spread: (spread: Spread) => number;
  count: (spread: Spread) => number;
  weighted: <T>(items: readonly Weighted<T>[]) => T;
  hex: (length: number) => string;
};

export let seedOf = (...parts: (string | number)[]) =>
  createHash('sha256').update(parts.join('\u0000')).digest().readUInt32LE(0);

export let createSampler = (seed: number): Sampler => {
  let random = createRandom(seed);

  let normal = () => {
    let u = Math.max(random.next(), Number.EPSILON);
    let v = random.next();

    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // Log-normal with the given median and 90th percentile, clamped to [min, max].
  let spread = (d: Spread) => {
    let sigma = d.p90 > d.median && d.median > 0 ? Math.log(d.p90 / d.median) / z90 : 0;
    let value = d.median * Math.exp(sigma * normal());

    return Math.min(d.max ?? Infinity, Math.max(d.min ?? 0, value));
  };

  let weighted = <T>(items: readonly Weighted<T>[]) => {
    let total = items.reduce((sum, item) => sum + item.weight, 0);
    let target = random.next() * total;

    for (let item of items) {
      target -= item.weight;
      if (target < 0) return item.value;
    }

    return items[items.length - 1]!.value;
  };

  let hex = (length: number) => {
    let out = '';
    while (out.length < length) out += Math.floor(random.next() * 16).toString(16);

    return out;
  };

  return {
    ...random,
    normal,
    spread,
    count: d => Math.round(spread(d)),
    weighted,
    hex
  };
};

export let stableHex = (length: number, ...parts: (string | number)[]) =>
  createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, length);

export let uuidOf = (...parts: (string | number)[]) => {
  let hex = stableHex(32, ...parts);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
