import type { GatewayPrincipal, PlatformLimitMetric } from '@mtsrc/ai-gateway-spec';
import {
  fixedWindow,
  intervalPeriod,
  intervalWindow,
  secondsPeriod,
  type LimitWindow
} from './windows';

export let microUsdPerUsd = 1_000_000;

export type LimitScope = 'token' | 'instance' | 'project';

export type LimitMetric = 'requests' | 'tokens' | 'spend';

export type LimitRule = {
  key: string;
  scope: LimitScope;
  scopeId: string;
  metric: LimitMetric;

  // Counter units: spend is counted in micro-USD so Redis can use integer increments.
  amount: number;
  period: string;
  window: LimitWindow;

  platformMetric: PlatformLimitMetric | null;
};

let counterAmount = (metric: LimitMetric, amount: number) =>
  metric == 'spend' ? Math.round(amount * microUsdPerUsd) : Math.floor(amount);

let counterKey = (d: {
  scope: LimitScope;
  scopeId: string;
  metric: LimitMetric;
  label: string;
  window: LimitWindow;
}) => `aigw:lim:c:${d.scope}:${d.scopeId}:${d.metric}:${d.label}:${d.window.start}`;

let platformMetrics: Record<PlatformLimitMetric, LimitMetric> = {
  requests: 'requests',
  tokens: 'tokens',
  metorial_spend_usd: 'spend'
};

export let limitRules = (principal: GatewayPrincipal, now: number): LimitRule[] => {
  let rules = new Map<string, LimitRule>();

  let add = (rule: Omit<LimitRule, 'key'>, label: string) => {
    let key = counterKey({ ...rule, label });
    let existing = rules.get(key);

    if (!existing || rule.amount < existing.amount) rules.set(key, { ...rule, key });
  };

  let tenantScopes: {
    scope: LimitScope;
    scopeId: string;
    limits: typeof principal.token.limits;
  }[] = [
    { scope: 'token', scopeId: principal.token.id, limits: principal.token.limits },
    { scope: 'instance', scopeId: principal.instance.id, limits: principal.instance.limits }
  ];

  for (let { scope, scopeId, limits } of tenantScopes) {
    for (let limit of limits) {
      let metric: LimitMetric = limit.metric == 'spend_usd' ? 'spend' : limit.metric;

      add(
        {
          scope,
          scopeId,
          metric,
          amount: counterAmount(metric, limit.amount),
          period: intervalPeriod(limit.interval),
          window: intervalWindow(limit.interval, now),
          platformMetric: null
        },
        limit.interval
      );
    }
  }

  for (let limit of principal.project.platformLimits) {
    let metric = platformMetrics[limit.metric];

    add(
      {
        scope: 'project',
        scopeId: principal.project.id,
        metric,
        amount: counterAmount(metric, limit.amount),
        period: secondsPeriod(limit.intervalSeconds),
        window: fixedWindow(limit.intervalSeconds * 1000, now),
        platformMetric: limit.metric
      },
      `${limit.intervalSeconds}s`
    );
  }

  return [...rules.values()];
};

export let onlyMetorialBilled = (rule: LimitRule) =>
  rule.platformMetric == 'metorial_spend_usd';
