import type { AgentTrackingCost, AgentTrackingTokens } from './types';

let moneyScale = 9;

let factor = 10n ** BigInt(moneyScale);
let decimalPattern = /^(-)?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d{1,3}))?$/;
let usdUnits: Record<string, bigint> = { usd: 1n, cents: 100n };
let nanosPerMicro = 1000n;

type ReportedAmount = { unit: string; basis: string | null; amount: unknown };

export let toNanos = (value: unknown): bigint | null => {
  if (typeof value == 'bigint') return value;

  let text =
    typeof value == 'number' && Number.isFinite(value)
      ? value.toFixed(moneyScale)
      : typeof value == 'string'
        ? value.trim()
        : null;

  let match = text ? decimalPattern.exec(text) : null;
  if (!match) return null;

  let digits = `${match[2]}${match[3] ?? ''}`;
  let point = match[2]!.length + Number(match[4] ?? 0);
  let integer = point <= 0 ? '0' : digits.slice(0, point).padEnd(point, '0');
  let fraction = point <= 0 ? `${'0'.repeat(-point)}${digits}` : digits.slice(point);

  let nanos =
    BigInt(integer) * factor + BigInt(fraction.slice(0, moneyScale).padEnd(moneyScale, '0'));
  if (Number(fraction[moneyScale] ?? '0') >= 5) nanos += 1n;

  return match[1] ? -nanos : nanos;
};

export let sumMoney = (values: unknown[]) => {
  let amounts = values.flatMap(value => toNanos(value) ?? []);

  return amounts.length ? amounts.reduce((sum, nanos) => sum + nanos, 0n) : null;
};

let reportedUsd = (reported: unknown, basis: string) => {
  if (!Array.isArray(reported)) return null;

  let total: bigint | null = null;

  for (let entry of reported as ReportedAmount[]) {
    let divisor = usdUnits[entry?.unit];
    if (!divisor || entry.basis != basis) continue;

    let nanos = toNanos(entry.amount);
    if (nanos !== null) total = (total ?? 0n) + nanos / divisor;
  }

  return total;
};

let toMicros = (nanos: bigint | null) => {
  if (nanos === null) return null;

  let micros = ((nanos < 0n ? -nanos : nanos) + nanosPerMicro / 2n) / nanosPerMicro;
  return Number(nanos < 0n ? -micros : micros);
};

export let microsOf = (value: unknown) => toMicros(toNanos(value));

// A sum without any cost is 0, not null; `unpriced` says when no request had one.
export let costOf = (d: {
  total: unknown;
  listPrice: unknown;
  reported: unknown;
  unpriced?: boolean;
  unpricedAtListPrice?: boolean;
}): AgentTrackingCost => {
  let total = d.unpriced ? null : toNanos(d.total);
  let billed = reportedUsd(d.reported, 'billed');

  let totalMicros = toMicros(total);
  let billedMicros = toMicros(billed);
  let estimatedMicros =
    totalMicros === null ? null : Math.max(0, totalMicros - (billedMicros ?? 0));

  return {
    totalMicros,
    billedMicros,
    estimatedMicros,
    isEstimate: estimatedMicros !== null && estimatedMicros > 0,
    reportedByClientMicros: toMicros(reportedUsd(d.reported, 'client_estimate')),
    listPriceMicros: d.unpricedAtListPrice ? null : toMicros(toNanos(d.listPrice))
  };
};

export let countOf = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) ? value : 0;

export let tokensOf = (value: unknown): AgentTrackingTokens => {
  let tokens = (value ?? {}) as Record<string, unknown>;

  let parts = {
    input: countOf(tokens.inputUncached),
    cacheRead: countOf(tokens.cacheRead),
    cacheWrite: countOf(tokens.cacheWrite),
    output: countOf(tokens.output),
    reasoning: countOf(tokens.reasoning)
  };

  return {
    ...parts,
    total:
      typeof tokens.total == 'number'
        ? tokens.total
        : parts.input + parts.cacheRead + parts.cacheWrite + parts.output + parts.reasoning
  };
};
