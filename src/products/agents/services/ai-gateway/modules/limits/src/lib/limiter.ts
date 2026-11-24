import type { InferenceLimiter, LimitDecision } from '@mtsrc/ai-gateway-module-inference';
import type { GatewayPrincipal } from '@mtsrc/ai-gateway-spec';
import { createLimitEventRecorder, type LimitEventRecorder } from './events';
import {
  limitExceededError,
  rateLimitHeaders,
  requestTooLargeError,
  retryAfter,
  type RateSnapshot
} from './messages';
import { limitRules, microUsdPerUsd, onlyMetorialBilled, type LimitRule } from './rules';
import type { LimitStore } from './store';

let expiryGraceMs = 60_000;

let expiresAt = (rule: LimitRule) => rule.window.end + expiryGraceMs;

let hasPlatformLimits = (principal: GatewayPrincipal) =>
  principal.project.platformLimits.length > 0;

export let createGatewayLimiter = (opts: {
  store: LimitStore;
  events?: LimitEventRecorder;
  now?: () => number;
}): InferenceLimiter => {
  let now = opts.now ?? Date.now;
  let store = opts.store;
  let events = opts.events ?? createLimitEventRecorder({ store, now });

  // Platform events feed usage reporting; losing one must never affect the request.
  let record = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      console.error('[ai-gateway] Could not record platform limit events', error);
    }
  };

  let recordDenied = (principal: GatewayPrincipal, rule: LimitRule) =>
    rule.platformMetric
      ? record(() =>
          events.denied({ projectId: principal.project.id, metric: rule.platformMetric! })
        )
      : Promise.resolve();

  return {
    acquire: async ({ principal, dialect, estimateInputTokens }) => {
      let at = now();
      let rules = limitRules(principal, at);
      if (!rules.length) return { allowed: true, headers: {} };

      let measured = rules.filter(rule => rule.metric != 'requests');
      let used = await store.read(measured.map(rule => rule.key));
      let usedOf = new Map(measured.map((rule, i) => [rule.key, used[i] ?? 0]));

      let estimate = measured.some(rule => rule.metric == 'tokens')
        ? Math.max(0, Math.ceil(estimateInputTokens()))
        : 0;

      let snapshots: RateSnapshot[] = measured
        .filter(rule => rule.metric == 'tokens')
        .map(rule => ({
          metric: 'tokens',
          limit: rule.amount,
          remaining: Math.max(0, rule.amount - usedOf.get(rule.key)!),
          resetAt: rule.window.end
        }));

      let deny = async (rule: LimitRule, opts: { tooLarge?: boolean } = {}) => {
        await recordDenied(principal, rule);

        let headers = rateLimitHeaders(dialect, snapshots, at);
        if (!opts.tooLarge) headers['retry-after'] = retryAfter(rule, at);

        return {
          allowed: false,
          error: opts.tooLarge
            ? requestTooLargeError(rule, estimate)
            : limitExceededError(rule, at),
          headers
        } satisfies LimitDecision;
      };

      let metorialBillingRule: LimitRule | undefined;

      for (let rule of measured) {
        let current = usedOf.get(rule.key)!;

        if (rule.metric == 'tokens') {
          if (estimate > rule.amount) return deny(rule, { tooLarge: true });
          if (current < rule.amount && current + estimate <= rule.amount) continue;
        } else if (current < rule.amount) {
          continue;
        }

        if (onlyMetorialBilled(rule)) {
          metorialBillingRule ??= rule;
          continue;
        }

        return deny(rule);
      }

      let requestRules = rules.filter(rule => rule.metric == 'requests');
      let counts = await store.increment(
        requestRules.map(rule => ({ key: rule.key, by: 1, expiresAt: expiresAt(rule) }))
      );

      snapshots.push(
        ...requestRules.map((rule, i) => ({
          metric: 'requests' as const,
          limit: rule.amount,
          remaining: Math.max(0, rule.amount - counts[i]!),
          resetAt: rule.window.end
        }))
      );

      let exceeded = requestRules.find((rule, i) => counts[i]! > rule.amount);
      if (exceeded) {
        await store.increment(
          requestRules.map(rule => ({ key: rule.key, by: -1, expiresAt: expiresAt(rule) }))
        );

        return deny(exceeded);
      }

      if (hasPlatformLimits(principal)) {
        await record(() =>
          events.used({ projectId: principal.project.id, amounts: { requests: 1 } })
        );
      }

      let decision: LimitDecision = {
        allowed: true,
        headers: rateLimitHeaders(dialect, snapshots, at)
      };

      if (metorialBillingRule) {
        let rule = metorialBillingRule;

        decision.metorialBillingLimit = {
          error: limitExceededError(rule, at),
          onEnforced: () => void recordDenied(principal, rule)
        };
      }

      return decision;
    },

    settle: async ({ principal, usage, billedCostUsd, metorialBilled }) => {
      let at = now();
      let rules = limitRules(principal, at);

      let tokens = usage.input.total + usage.output.total;
      let spend = Math.max(0, Math.round(billedCostUsd * microUsdPerUsd));

      let increments = rules.flatMap(rule => {
        let by = 0;
        if (rule.metric == 'tokens') by = tokens;
        if (rule.metric == 'spend' && (metorialBilled || !onlyMetorialBilled(rule)))
          by = spend;

        return by > 0 ? [{ key: rule.key, by, expiresAt: expiresAt(rule) }] : [];
      });

      if (increments.length) await store.increment(increments);

      if (hasPlatformLimits(principal)) {
        await record(() =>
          events.used({
            projectId: principal.project.id,
            amounts: { tokens, metorial_spend_usd: metorialBilled ? spend : 0 }
          })
        );
      }
    }
  };
};
