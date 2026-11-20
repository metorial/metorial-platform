import { UsageError } from '../lib/safety';
import type { Clock } from '../lib/clock';

let maxSteps = 50;

type Pacer = {
  take: (units: number) => Promise<{ scheduledAt: number }>;
  nextAt: () => number;
};

// Open loop: slots are fixed by the target rate, not by how fast the service answers, so a slow
// service shows up as latency and backlog instead of quietly lowering the offered load.
export let createPacer = (d: {
  ratePerSecond: number;
  startAt: number;
  clock: Clock;
}): Pacer => {
  let nextAt = d.startAt;
  let interval = 1000 / d.ratePerSecond;

  return {
    take: async units => {
      let scheduledAt = nextAt;
      nextAt += units * interval;

      let wait = scheduledAt - d.clock.now();
      if (wait > 0) await d.clock.sleep(wait);

      return { scheduledAt };
    },

    nextAt: () => nextAt
  };
};

export let parseRates = (d: { rates?: string[]; ramp?: string }): number[] => {
  if (d.rates?.length && d.ramp)
    throw new UsageError('Pass either --rates or --ramp, not both.');

  let rates: number[];

  if (d.rates?.length) {
    rates = d.rates.map(Number);
  } else if (d.ramp) {
    let match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):(x?)(\d+(?:\.\d+)?)$/.exec(d.ramp);
    if (!match) {
      throw new UsageError(
        '--ramp takes from:to:step (linear) or from:to:xFactor (geometric).'
      );
    }

    let from = Number(match[1]);
    let to = Number(match[2]);
    let geometric = match[3] == 'x';
    let step = Number(match[4]);

    if (geometric ? step <= 1 : step <= 0)
      throw new UsageError('--ramp step must grow the rate.');

    rates = [];
    for (let rate = from; rate <= to + 1e-9 && rates.length < maxSteps;) {
      rates.push(Math.round(rate * 100) / 100);
      rate = geometric ? rate * step : rate + step;
    }
  } else {
    throw new UsageError('Pass --rates a,b,c or --ramp from:to:step (records per second).');
  }

  if (!rates.length || rates.some(rate => !Number.isFinite(rate) || rate <= 0)) {
    throw new UsageError('Rates must be positive numbers of records per second.');
  }
  if (rates.length > maxSteps) throw new UsageError(`At most ${maxSteps} steps.`);

  return rates;
};

export let retryDelayMs = (d: {
  retryAfter: string | null;
  attempt: number;
  now: number;
  jitter: number;
  maxMs: number;
}) => {
  let header = d.retryAfter?.trim();

  if (header) {
    let seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(d.maxMs, seconds * 1000);

    let date = Date.parse(header);
    if (!isNaN(date)) return Math.min(d.maxMs, Math.max(0, date - d.now));
  }

  let backoff = Math.min(d.maxMs, 1000 * 2 ** d.attempt);

  return backoff * (0.5 + d.jitter / 2);
};
