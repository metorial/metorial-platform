import { describe, expect, it } from 'vitest';
import { gatewayLimitsSchema, maxGatewayLimits, platformLimitsSchema } from '../src/limits';

describe('gatewayLimitsSchema', () => {
  it('accepts every metric and interval', () => {
    expect(
      gatewayLimitsSchema.validate([
        { metric: 'requests', amount: 60, interval: '1m' },
        { metric: 'tokens', amount: 100_000, interval: '1h' },
        { metric: 'tokens', amount: 1_000_000, interval: '1d' },
        { metric: 'spend_usd', amount: 12.5, interval: '1mo' }
      ]).success
    ).toBe(true);
    expect(gatewayLimitsSchema.validate([]).success).toBe(true);
  });

  it.each([
    ['a zero amount', [{ metric: 'requests', amount: 0, interval: '1m' }]],
    ['a negative amount', [{ metric: 'tokens', amount: -5, interval: '1m' }]],
    ['an unknown metric', [{ metric: 'images', amount: 5, interval: '1m' }]],
    ['an unknown interval', [{ metric: 'requests', amount: 5, interval: '1w' }]],
    ['a missing interval', [{ metric: 'requests', amount: 5 }]],
    [
      'too many limits',
      Array.from({ length: maxGatewayLimits + 1 }, () => ({
        metric: 'requests',
        amount: 1,
        interval: '1m'
      }))
    ],
    ['the old object shape', { requestsPerMinute: 10 }]
  ])('rejects %s', (_, limits) => {
    expect(gatewayLimitsSchema.validate(limits).success).toBe(false);
  });
});

describe('platformLimitsSchema', () => {
  it('accepts plan limits, including a zero allowance', () => {
    expect(
      platformLimitsSchema.validate([
        { metric: 'requests', amount: 100, intervalSeconds: 60 },
        { metric: 'tokens', amount: 50_000, intervalSeconds: 86_400 },
        { metric: 'metorial_spend_usd', amount: 0, intervalSeconds: 86_400 }
      ]).success
    ).toBe(true);
  });

  it.each([
    ['a negative amount', { metric: 'tokens', amount: -1, intervalSeconds: 60 }],
    ['an interval over a day', { metric: 'tokens', amount: 1, intervalSeconds: 86_401 }],
    ['a zero interval', { metric: 'tokens', amount: 1, intervalSeconds: 0 }],
    ['a fractional interval', { metric: 'tokens', amount: 1, intervalSeconds: 1.5 }],
    ['a tenant metric', { metric: 'spend_usd', amount: 1, intervalSeconds: 60 }]
  ])('rejects %s', (_, limit) => {
    expect(platformLimitsSchema.validate([limit]).success).toBe(false);
  });
});
