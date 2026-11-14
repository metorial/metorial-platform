import { MAX_RATE_LIMIT_INTERVAL_SECONDS, MIN_RATE_LIMIT_INTERVAL_SECONDS } from './catalog';

let unitSeconds = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24
};

export type RateLimitIntervalUnit = keyof typeof unitSeconds;

export type RateLimitInterval = `${number}${RateLimitIntervalUnit}` | number;

export let parseRateLimitInterval = (interval: RateLimitInterval) => {
  let seconds: number;

  if (typeof interval == 'number') {
    seconds = interval;
  } else {
    let match = /^(\d+)([smhd])$/.exec(interval);
    if (!match) throw new Error(`Invalid rate limit interval: ${interval}`);

    seconds = Number(match[1]) * unitSeconds[match[2] as RateLimitIntervalUnit];
  }

  if (
    !Number.isInteger(seconds) ||
    seconds < MIN_RATE_LIMIT_INTERVAL_SECONDS ||
    seconds > MAX_RATE_LIMIT_INTERVAL_SECONDS
  ) {
    throw new Error(
      `Rate limit interval must be between ${MIN_RATE_LIMIT_INTERVAL_SECONDS}s and ${MAX_RATE_LIMIT_INTERVAL_SECONDS}s, got ${interval}`
    );
  }

  return seconds;
};

export let formatRateLimitInterval = (seconds: number) => {
  for (let unit of ['d', 'h', 'm'] as const) {
    if (seconds % unitSeconds[unit] == 0) return `${seconds / unitSeconds[unit]}${unit}`;
  }

  return `${seconds}s`;
};
