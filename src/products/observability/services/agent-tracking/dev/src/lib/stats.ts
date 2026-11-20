export type Summary = {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
};

// Linear interpolation between closest ranks, so small samples do not snap to their maximum.
export let percentile = (sorted: number[], p: number): number | null => {
  if (sorted.length == 0) return null;
  if (sorted.length == 1) return sorted[0]!;

  let rank = (p / 100) * (sorted.length - 1);
  let lower = Math.floor(rank);
  let upper = Math.ceil(rank);
  let weight = rank - lower;

  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
};

export let mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export let summarize = (values: number[]): Summary => {
  let sorted = [...values].sort((a, b) => a - b);
  let count = sorted.length;

  return {
    count,
    min: count ? sorted[0]! : null,
    max: count ? sorted[count - 1]! : null,
    mean: mean(sorted),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99)
  };
};

export let round = (value: number | null, digits = 1) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

export let ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
