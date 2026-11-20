import type { AgentTrackingCost, AgentTrackingTokens } from './types';

let moneyScale = 9;

let factor = 10n ** BigInt(moneyScale);
let decimalPattern = /^(-)?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d{1,3}))?$/;
let usdUnits: Record<string, bigint> = { usd: 1n, cents: 100n };

type ReportedAmount = { unit: string; basis: string | null; amount: unknown };

// Money arrives as a number rounded to 9 decimals (query results) or as a decimal string
// (sessions), which Decimal128 writes in exponent form below 1e-6. Both are held as integer
// nano-dollars so sums and differences never lose cents.
export let toNanos = (value: unknown): bigint | null => {
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

let formatNanos = (nanos: bigint) => {
  let negative = nanos < 0n;
  let absolute = negative ? -nanos : nanos;
  let fraction = (absolute % factor).toString().padStart(moneyScale, '0').replace(/0+$/, '');

  return `${negative ? '-' : ''}${absolute / factor}${fraction ? `.${fraction}` : ''}`;
};

export let sumMoney = (values: unknown[]) => {
  let amounts = values.flatMap(value => toNanos(value) ?? []);

  return amounts.length ? formatNanos(amounts.reduce((sum, nanos) => sum + nanos, 0n)) : null;
};

export let formatMoney = (value: unknown) => {
  let nanos = toNanos(value);

  return nanos === null ? null : formatNanos(nanos);
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

// A sum over usage without any cost is 0, not null, so `unpriced` says when none of the
// requests behind a figure had one.
export let costOf = (d: {
  total: unknown;
  listPrice: unknown;
  reported: unknown;
  unpriced?: boolean;
  unpricedAtListPrice?: boolean;
}): AgentTrackingCost => {
  let total = d.unpriced ? null : toNanos(d.total);
  let billed = reportedUsd(d.reported, 'billed');
  let reportedByClient = reportedUsd(d.reported, 'client_estimate');

  let estimated = total === null ? null : total - (billed ?? 0n);
  if (estimated !== null && estimated < 0n) estimated = 0n;

  return {
    total: total === null ? null : formatNanos(total),
    billed: billed === null ? null : formatNanos(billed),
    estimated: estimated === null ? null : formatNanos(estimated),
    isEstimate: estimated !== null && estimated > 0n,
    reportedByClient: reportedByClient === null ? null : formatNanos(reportedByClient),
    listPrice: d.unpricedAtListPrice ? null : formatMoney(d.listPrice)
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
