import type { Pricing } from '@metorial/model-catalog/src/types';
import { describe, expect, it } from 'vitest';
import { createCatalogIndex } from '@mtsrc/agent-tracking-model-resolver';
import { fixtureCatalog } from '@mtsrc/agent-tracking-model-resolver/test/fixture';
import { pricing } from '@mtsrc/agent-tracking-module-knowledge/test/fixtures';
import { contractAmount, effectivePricing, scalePricing } from '../src/lib/contract';
import { createOverridePricer, overrideRequestOf } from '../src/lib/pricer';
import { override } from './fixtures';
import { formatAmount, parseAmount } from '@mtsrc/agent-tracking-cost';

let tokens = (values: Partial<Parameters<typeof contractAmount>[0]['tokens']> = {}) => ({
  inputUncached: 0,
  cacheRead: 0,
  cacheWrite: 0,
  output: 0,
  reasoning: 0,
  ...values
});

let tiered: Pricing = {
  ...pricing(2, 10),
  text: {
    input: 2,
    output: 10,
    cacheRead: 0.2,
    cacheWrite: [
      { ttl: '5m', price: 2.5 },
      { ttl: '1h', price: 4 }
    ],
    reasoning: null
  },
  contextTiers: [{ minInputTokens: 200_000, input: 4, output: 20, cacheRead: 0.4 }]
};

let amount = (value: string) => parseAmount(value)!;

let format = (value: bigint | undefined) =>
  value === undefined ? undefined : formatAmount(value);

describe('contractAmount', () => {
  it('scales the list cost by a multiplier, exactly', () => {
    expect(
      format(
        contractAmount({
          override: override({ kind: 'multiplier', multiplier: '0.8' }),
          list: amount('12.345'),
          tokens: tokens({ inputUncached: 1 }),
          contextTokens: 1
        })
      )
    ).toBe('9.876');

    expect(
      format(
        contractAmount({
          override: override({ kind: 'multiplier', multiplier: '0' }),
          list: amount('5'),
          tokens: undefined,
          contextTokens: 0
        })
      )
    ).toBe('0');
  });

  it('leaves a request without a list cost unpriced under a multiplier', () => {
    expect(
      contractAmount({
        override: override({ kind: 'multiplier', multiplier: '0.8' }),
        list: undefined,
        tokens: tokens({ inputUncached: 1_000_000 }),
        contextTokens: 1_000_000
      })
    ).toBeUndefined();
  });

  it('prices a rates override with its own tiers and cache write TTLs', () => {
    let rates = override({ kind: 'rates', multiplier: null, rates: tiered });

    expect(
      format(
        contractAmount({
          override: rates,
          list: amount('999'),
          tokens: tokens({ inputUncached: 1_000_000, output: 100_000 }),
          contextTokens: 10_000
        })
      )
    ).toBe('3');

    expect(
      format(
        contractAmount({
          override: rates,
          list: undefined,
          tokens: tokens({ inputUncached: 1_000_000, output: 100_000 }),
          contextTokens: 250_000
        })
      )
    ).toBe('6');

    expect(
      format(
        contractAmount({
          override: rates,
          list: undefined,
          tokens: tokens({
            cacheWrite: 2_000_000,
            cacheWrite5m: 1_000_000,
            cacheWrite1h: 1_000_000
          }),
          contextTokens: 0
        })
      )
    ).toBe('6.5');
  });

  it('needs token counts to price with rates', () => {
    expect(
      contractAmount({
        override: override({ kind: 'rates', multiplier: null, rates: tiered }),
        list: amount('1'),
        tokens: undefined,
        contextTokens: 0
      })
    ).toBeUndefined();
  });

  it('prices included usage at zero, with or without a list cost', () => {
    let included = override({ kind: 'included', multiplier: null });

    expect(
      contractAmount({
        override: included,
        list: amount('7'),
        tokens: tokens(),
        contextTokens: 0
      })
    ).toBe(0n);
    expect(
      contractAmount({
        override: included,
        list: undefined,
        tokens: undefined,
        contextTokens: 0
      })
    ).toBe(0n);
  });
});

describe('effectivePricing', () => {
  it('returns the list rates without an override', () => {
    expect(effectivePricing({ list: tiered, override: null })).toBe(tiered);
    expect(effectivePricing({ list: null, override: null })).toBeNull();
  });

  it('scales every rate by a multiplier and keeps unknown rates unknown', () => {
    let scaled = effectivePricing({
      list: tiered,
      override: override({ kind: 'multiplier', multiplier: '0.5' })
    })!;

    expect(scaled.text).toEqual({
      input: 1,
      output: 5,
      cacheRead: 0.1,
      cacheWrite: [
        { ttl: '5m', price: 1.25 },
        { ttl: '1h', price: 2 }
      ],
      reasoning: null
    });
    expect(scaled.contextTiers).toEqual([
      { minInputTokens: 200_000, input: 2, output: 10, cacheRead: 0.2 }
    ]);
    expect(
      effectivePricing({ list: null, override: override({ kind: 'multiplier' }) })
    ).toBeNull();
  });

  it('uses the override rates, or zero for included usage', () => {
    let rates = pricing(1, 2);

    expect(
      effectivePricing({
        list: tiered,
        override: override({ kind: 'rates', multiplier: null, rates })
      })
    ).toBe(rates);

    let included = override({ kind: 'included', multiplier: null });
    expect(effectivePricing({ list: tiered, override: included })).toEqual(
      scalePricing(tiered, 0)
    );
    expect(effectivePricing({ list: null, override: included })!.text).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: [],
      reasoning: 0
    });
  });
});

describe('createOverridePricer', () => {
  let catalog = createCatalogIndex(fixtureCatalog);
  let resolution = {
    modelId: 'claude-sonnet-4-5',
    vendorId: 'anthropic',
    agentId: 'claude-code'
  };

  it('maps the resolved model to its family and lab from the core cache', () => {
    expect(
      overrideRequestOf({
        at: new Date('2026-03-04T10:00:00Z'),
        organizationId: 'ator_a',
        projectId: 'atpr_a',
        resolution,
        billingMode: 'api',
        catalog
      })
    ).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      familyId: 'claude-sonnet',
      labId: 'anthropic',
      agentId: 'claude-code',
      vendorId: 'anthropic',
      billingMode: 'api'
    });
  });

  it('is absent without overrides', () => {
    expect(
      createOverridePricer({
        overrides: [],
        organizationId: 'ator_a',
        projectId: 'atpr_a',
        catalog
      })
    ).toBeNull();
  });

  it('prices with the single matching override and nothing else', () => {
    let family = override({ target: 'family', targetId: 'claude-sonnet', multiplier: '0.5' });
    let lab = override({
      target: 'lab',
      targetId: 'anthropic',
      kind: 'included',
      multiplier: null
    });

    let price = createOverridePricer({
      overrides: [lab, family],
      organizationId: 'ator_a',
      projectId: 'atpr_a',
      catalog
    })!;

    let priced = price({
      at: new Date('2026-03-04T10:00:00Z'),
      resolution,
      billingMode: 'unknown',
      list: amount('4'),
      tokens: tokens({ inputUncached: 1 }),
      contextTokens: 1
    });
    expect(priced?.override.id).toBe(family.id);
    expect(format(priced?.amount)).toBe('2');

    expect(
      price({
        at: new Date('2026-03-04T10:00:00Z'),
        resolution,
        billingMode: 'unknown',
        list: undefined,
        tokens: tokens({ inputUncached: 1 }),
        contextTokens: 1
      })
    ).toBeUndefined();
  });

  it('matches overrides against the request’s billing mode', () => {
    let plan = override({
      target: 'agent',
      targetId: 'claude-code',
      billingModes: ['included'],
      kind: 'included',
      multiplier: null
    });

    let price = createOverridePricer({
      overrides: [plan],
      organizationId: 'ator_a',
      projectId: 'atpr_a',
      catalog
    })!;
    let request = {
      at: new Date('2026-03-04T10:00:00Z'),
      resolution,
      list: amount('4'),
      tokens: tokens({ inputUncached: 1 }),
      contextTokens: 1
    };

    let covered = price({ ...request, billingMode: 'included' });
    expect(covered?.override.id).toBe(plan.id);
    expect(format(covered?.amount)).toBe('0');

    expect(price({ ...request, billingMode: 'api' })).toBeUndefined();
    expect(price({ ...request, billingMode: 'unknown' })).toBeUndefined();
  });
});
