import type { GatewayLimitInterval } from '@mtsrc/ai-gateway-spec';

export type LimitWindow = { start: number; end: number };

let intervalMs: Record<Exclude<GatewayLimitInterval, '1mo'>, number> = {
  '1m': 60_000,
  '1h': 3_600_000,
  '1d': 86_400_000
};

let intervalPeriods: Record<GatewayLimitInterval, string> = {
  '1m': 'minute',
  '1h': 'hour',
  '1d': 'day',
  '1mo': 'month'
};

export let fixedWindow = (lengthMs: number, now: number): LimitWindow => {
  let start = Math.floor(now / lengthMs) * lengthMs;
  return { start, end: start + lengthMs };
};

export let intervalWindow = (interval: GatewayLimitInterval, now: number): LimitWindow => {
  if (interval != '1mo') return fixedWindow(intervalMs[interval], now);

  let date = new Date(now);
  return {
    start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    end: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
  };
};

export let intervalPeriod = (interval: GatewayLimitInterval) => intervalPeriods[interval];

export let secondsPeriod = (seconds: number) => {
  if (seconds == 60) return 'minute';
  if (seconds == 3600) return 'hour';
  if (seconds == 86400) return 'day';
  if (seconds % 3600 == 0) return `${seconds / 3600} hours`;
  if (seconds % 60 == 0) return `${seconds / 60} minutes`;

  return `${seconds} seconds`;
};
