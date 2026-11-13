let nanosPerMilli = 1_000_000n;

export let dateFromNanos = (nanos: bigint): Date | null => {
  if (nanos <= 0n) return null;

  return new Date(Number(nanos / nanosPerMilli));
};

export let dateFromValue = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value == 'string' || typeof value == 'number') return new Date(value);

  return new Date(Number.NaN);
};

export let firstDate = (...candidates: (Date | null)[]): Date | null =>
  candidates.find(candidate => candidate !== null) ?? null;
