import { describe, expect, it } from 'vitest';
import { limitRules, onlyMetorialBilled } from '../src/lib/rules';
import { noon, principalWith } from './fixtures';

describe('limitRules', () => {
  it('has no rules without limits', () => {
    expect(limitRules(principalWith(), noon)).toEqual([]);
  });

  it('builds token, instance and project rules with their own counters', () => {
    let rules = limitRules(
      principalWith({
        token: [{ metric: 'requests', amount: 10, interval: '1m' }],
        instance: [{ metric: 'requests', amount: 100, interval: '1m' }],
        platform: [{ metric: 'requests', amount: 1000, intervalSeconds: 60 }]
      }),
      noon
    );

    expect(rules.map(rule => [rule.scope, rule.scopeId, rule.amount])).toEqual([
      ['token', 'gwtk_1', 10],
      ['instance', 'gwin_1', 100],
      ['project', 'gwpr_1', 1000]
    ]);
    expect(new Set(rules.map(rule => rule.key)).size).toBe(3);
  });

  it('counts spend in micro-USD and floors fractional request and token amounts', () => {
    let rules = limitRules(
      principalWith({
        token: [
          { metric: 'spend_usd', amount: 12.345678, interval: '1mo' },
          { metric: 'tokens', amount: 1000.9, interval: '1h' },
          { metric: 'requests', amount: 5.5, interval: '1d' }
        ]
      }),
      noon
    );

    expect(rules.map(rule => [rule.metric, rule.amount, rule.period])).toEqual([
      ['spend', 12_345_678, 'month'],
      ['tokens', 1000, 'hour'],
      ['requests', 5, 'day']
    ]);
  });

  it('keeps the strictest of duplicate limits', () => {
    let rules = limitRules(
      principalWith({
        token: [
          { metric: 'requests', amount: 50, interval: '1m' },
          { metric: 'requests', amount: 20, interval: '1m' },
          { metric: 'requests', amount: 30, interval: '1m' },
          { metric: 'requests', amount: 500, interval: '1h' }
        ]
      }),
      noon
    );

    expect(rules.map(rule => [rule.amount, rule.period])).toEqual([
      [20, 'minute'],
      [500, 'hour']
    ]);
  });

  it('moves counters to a new key in every window', () => {
    let principal = principalWith({
      token: [{ metric: 'requests', amount: 1, interval: '1m' }]
    });

    let first = limitRules(principal, noon)[0]!;
    let sameMinute = limitRules(principal, noon + 59_999)[0]!;
    let nextMinute = limitRules(principal, noon + 60_000)[0]!;

    expect(sameMinute.key).toBe(first.key);
    expect(nextMinute.key).not.toBe(first.key);
    expect(nextMinute.window.start).toBe(first.window.end);
  });

  it('maps platform limits to rules and marks Metorial spend', () => {
    let rules = limitRules(
      principalWith({
        platform: [
          { metric: 'tokens', amount: 100_000, intervalSeconds: 86_400 },
          { metric: 'metorial_spend_usd', amount: 5, intervalSeconds: 86_400 }
        ]
      }),
      noon
    );

    expect(
      rules.map(rule => [rule.metric, rule.amount, rule.period, rule.platformMetric])
    ).toEqual([
      ['tokens', 100_000, 'day', 'tokens'],
      ['spend', 5_000_000, 'day', 'metorial_spend_usd']
    ]);
    expect(rules.map(onlyMetorialBilled)).toEqual([false, true]);
    expect(rules[0]!.window).toEqual({
      start: Date.UTC(2026, 10, 20),
      end: Date.UTC(2026, 10, 21)
    });
  });

  it('never shares counters between tokens, instances or projects with the same id', () => {
    let rules = limitRules(
      principalWith({
        tokenId: 'same',
        instanceId: 'same',
        projectId: 'same',
        token: [{ metric: 'tokens', amount: 1, interval: '1d' }],
        instance: [{ metric: 'tokens', amount: 1, interval: '1d' }],
        platform: [{ metric: 'tokens', amount: 1, intervalSeconds: 86_400 }]
      }),
      noon
    );

    expect(new Set(rules.map(rule => rule.key)).size).toBe(3);
  });
});
