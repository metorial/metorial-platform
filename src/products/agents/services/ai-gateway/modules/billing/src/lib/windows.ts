export let billingWindowMs = 5 * 60_000;

// Usage lands in the window that is open when it is written, so a window is final once it ended
// and every flush that could still target it has finished.
export let billingSealGraceMs = 60_000;

export let billingWindowOf = (now: Date) => {
  let start = Math.floor(now.getTime() / billingWindowMs) * billingWindowMs;

  return { start: new Date(start), end: new Date(start + billingWindowMs) };
};

let nanoUsdPerUsd = 1_000_000_000;

export let toNanoUsd = (usd: number) =>
  Number.isFinite(usd) && usd > 0 ? BigInt(Math.round(usd * nanoUsdPerUsd)) : 0n;

export let toMicroUsd = (nanoUsd: bigint) => Number((nanoUsd + 500n) / 1000n);
