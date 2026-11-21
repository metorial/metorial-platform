import type { Dialect, GatewayError } from '@mtsrc/ai-gateway-dialects';
import { microUsdPerUsd, type LimitRule } from './rules';

export type RateSnapshot = {
  metric: 'requests' | 'tokens';
  limit: number;
  remaining: number;
  resetAt: number;
};

let subjects: Record<LimitRule['scope'], string> = {
  token: 'This API key',
  instance: 'This gateway instance',
  project: "This project's plan"
};

let objects: Record<LimitRule['scope'], string> = {
  token: 'this API key',
  instance: 'this gateway instance',
  project: "this project's plan"
};

let describeAmount = (rule: LimitRule) => {
  if (rule.metric == 'requests') return `${rule.amount} requests`;
  if (rule.metric == 'tokens') return `${rule.amount} tokens`;

  return `$${Number((rule.amount / microUsdPerUsd).toFixed(6))}`;
};

export let describeWait = (ms: number) => {
  let seconds = Math.max(1, Math.ceil(ms / 1000));
  let plural = (value: number, unit: string) => `${value} ${unit}${value == 1 ? '' : 's'}`;

  if (seconds < 60) return plural(seconds, 'second');
  if (seconds < 3600) return plural(Math.ceil(seconds / 60), 'minute');
  if (seconds < 86400) return plural(Math.ceil(seconds / 3600), 'hour');

  return plural(Math.ceil(seconds / 86400), 'day');
};

export let limitExceededError = (rule: LimitRule, now: number): GatewayError => {
  let amount = describeAmount(rule);
  let wait = describeWait(rule.window.end - now);

  if (rule.scope == 'project') {
    if (rule.platformMetric == 'metorial_spend_usd') {
      return {
        status: 429,
        code: 'plan_limit_exceeded',
        message: `${subjects.project} includes ${amount} of Metorial-billed usage per ${rule.period}. Connect your own provider keys or try again in ${wait}.`
      };
    }

    return {
      status: 429,
      code: 'plan_limit_exceeded',
      message: `${subjects.project} allows ${amount} per ${rule.period}. Try again in ${wait}.`
    };
  }

  if (rule.metric == 'spend') {
    return {
      status: 429,
      code: 'spend_limit_exceeded',
      message: `${subjects[rule.scope]} reached its spend limit of ${amount} per ${rule.period}. Try again in ${wait}.`
    };
  }

  return {
    status: 429,
    code: 'rate_limit_exceeded',
    message: `${subjects[rule.scope]} is limited to ${amount} per ${rule.period}. Try again in ${wait}.`
  };
};

export let requestTooLargeError = (
  rule: LimitRule,
  estimatedTokens: number
): GatewayError => ({
  status: 429,
  code: rule.scope == 'project' ? 'plan_limit_exceeded' : 'rate_limit_exceeded',
  message: `This request needs about ${estimatedTokens} input tokens, but ${objects[rule.scope]} only allows ${describeAmount(rule)} per ${rule.period}.`
});

// OpenAI formats resets as Go durations ("6m0s", "1.5s", "20ms").
export let goDuration = (ms: number) => {
  if (ms < 1000) return `${Math.max(0, Math.ceil(ms))}ms`;

  let totalSeconds = ms / 1000;
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = `${Number((totalSeconds % 60).toFixed(3))}s`;

  if (hours) return `${hours}h${minutes}m${seconds}`;
  if (minutes) return `${minutes}m${seconds}`;

  return seconds;
};

let rfc3339 = (at: number) => new Date(at).toISOString().replace(/\.\d{3}Z$/, 'Z');

let tightest = (snapshots: RateSnapshot[]) =>
  snapshots.reduce<RateSnapshot | undefined>(
    (best, snapshot) =>
      !best ||
      snapshot.remaining < best.remaining ||
      (snapshot.remaining == best.remaining && snapshot.resetAt < best.resetAt)
        ? snapshot
        : best,
    undefined
  );

export let rateLimitHeaders = (dialect: Dialect, snapshots: RateSnapshot[], now: number) => {
  let headers: Record<string, string> = {};

  for (let metric of ['requests', 'tokens'] as const) {
    let snapshot = tightest(snapshots.filter(entry => entry.metric == metric));
    if (!snapshot) continue;

    if (dialect == 'anthropic_messages') {
      headers[`anthropic-ratelimit-${metric}-limit`] = String(snapshot.limit);
      headers[`anthropic-ratelimit-${metric}-remaining`] = String(snapshot.remaining);
      headers[`anthropic-ratelimit-${metric}-reset`] = rfc3339(snapshot.resetAt);
    } else {
      headers[`x-ratelimit-limit-${metric}`] = String(snapshot.limit);
      headers[`x-ratelimit-remaining-${metric}`] = String(snapshot.remaining);
      headers[`x-ratelimit-reset-${metric}`] = goDuration(snapshot.resetAt - now);
    }
  }

  return headers;
};

export let retryAfter = (rule: LimitRule, now: number) =>
  String(Math.max(1, Math.ceil((rule.window.end - now) / 1000)));
