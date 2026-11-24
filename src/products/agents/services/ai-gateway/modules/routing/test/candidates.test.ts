import type { Pricing, ProviderFeatures } from '@mtsrc/ai-gateway-spec';
import { describe, expect, it } from 'vitest';
import { isModelAllowed } from '../src/lib/allowedModels';
import {
  selectCandidates,
  type CustomerConnectionOption,
  type OfferingOption,
  type RouteCandidate,
  type RoutingRuleOption
} from '../src/lib/candidates';

let pricing = (input: number): Pricing => ({
  currency: 'USD',
  text: { input, output: input * 5, cacheRead: null, cacheWrite: [], reasoning: null },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: null
});

let sonnet = { slug: 'anthropic/claude-sonnet-5', labSlug: 'anthropic' };

let offerings: OfferingOption[] = [
  {
    id: 'of_anthropic_dated',
    providerSlug: 'anthropic',
    vendorModelId: 'claude-sonnet-5-20261001',
    pricing: pricing(3)
  },
  {
    id: 'of_anthropic',
    providerSlug: 'anthropic',
    vendorModelId: 'claude-sonnet-5',
    pricing: pricing(3)
  },
  {
    id: 'of_azure',
    providerSlug: 'azure',
    vendorModelId: 'claude-sonnet-5',
    pricing: pricing(3.3)
  },
  { id: 'of_aws', providerSlug: 'aws-bedrock', vendorModelId: 'x', pricing: pricing(3) }
];

let connection = (
  d: Partial<CustomerConnectionOption> & { id: string; providerSlug: string }
): CustomerConnectionOption => ({
  priority: 0,
  status: 'valid',
  features: {},
  pricingOverride: null,
  createdAt: new Date('2026-01-01'),
  ...d
});

let rule = (
  d: Partial<RoutingRuleOption> & {
    slug: string;
    providerSlug: string;
    connectionSlug?: string;
    features?: ProviderFeatures;
  }
): RoutingRuleOption => ({
  priority: 0,
  weight: 1,
  labSlug: 'anthropic',
  modelSlug: null,
  pricingOverride: null,
  ...d,
  connection: {
    slug: d.connectionSlug ?? `pc_${d.slug}`,
    providerSlug: d.providerSlug,
    status: 'valid',
    features: d.features ?? {}
  }
});

let connectionOf = (candidate: RouteCandidate) =>
  candidate.connectionOwner == 'customer'
    ? candidate.connectionId
    : candidate.platformConnectionSlug;

let ruleOf = (candidate: RouteCandidate) =>
  candidate.connectionOwner == 'platform' ? candidate.routingRuleSlug : undefined;

let select = (d: Partial<Parameters<typeof selectCandidates>[0]>) =>
  selectCandidates({
    model: sonnet,
    target: { kind: 'any' },
    offerings,
    connections: [],
    rules: [],
    metorialEnabled: true,
    random: () => 0.5,
    ...d
  });

describe('selectCandidates', () => {
  it('uses customer connections before metorial rules', () => {
    let candidates = select({
      connections: [connection({ id: 'pc_customer', providerSlug: 'azure' })],
      rules: [rule({ slug: 'rr_1', providerSlug: 'anthropic' })]
    });

    expect(
      candidates.map(candidate => [connectionOf(candidate), candidate.connectionOwner])
    ).toEqual([
      ['pc_customer', 'customer'],
      ['pc_rr_1', 'platform']
    ]);
  });

  it('skips connections whose provider does not offer the model', () => {
    let candidates = select({
      connections: [connection({ id: 'pc_openai', providerSlug: 'openai' })]
    });

    expect(candidates).toEqual([]);
  });

  it('skips unusable connections and orders valid before pending', () => {
    let candidates = select({
      connections: [
        connection({ id: 'pc_pending', providerSlug: 'anthropic', status: 'pending' }),
        connection({ id: 'pc_invalid', providerSlug: 'anthropic', status: 'invalid' }),
        connection({ id: 'pc_disabled', providerSlug: 'anthropic', status: 'disabled' }),
        connection({ id: 'pc_valid', providerSlug: 'azure' })
      ]
    });

    expect(candidates.map(candidate => connectionOf(candidate))).toEqual([
      'pc_valid',
      'pc_pending'
    ]);
  });

  it('orders customer connections by priority, then first-party provider', () => {
    let candidates = select({
      connections: [
        connection({ id: 'pc_azure', providerSlug: 'azure' }),
        connection({ id: 'pc_anthropic', providerSlug: 'anthropic' }),
        connection({ id: 'pc_azure_high', providerSlug: 'azure', priority: 10 })
      ]
    });

    expect(candidates.map(candidate => connectionOf(candidate))).toEqual([
      'pc_azure_high',
      'pc_anthropic',
      'pc_azure'
    ]);
  });

  it('prefers the shortest offering id unless one is pinned', () => {
    let connections = [connection({ id: 'pc_anthropic', providerSlug: 'anthropic' })];

    expect(select({ connections })[0]!.vendorModelId).toBe('claude-sonnet-5');
    expect(
      select({
        connections,
        target: {
          kind: 'provider',
          providerSlug: 'anthropic',
          vendorModelId: 'claude-sonnet-5-20261001'
        }
      })[0]!.vendorModelId
    ).toBe('claude-sonnet-5-20261001');
  });

  it('never falls back to metorial when a provider is pinned', () => {
    let candidates = select({
      target: { kind: 'provider', providerSlug: 'azure' },
      connections: [connection({ id: 'pc_anthropic', providerSlug: 'anthropic' })],
      rules: [rule({ slug: 'rr_1', providerSlug: 'azure' })]
    });

    expect(candidates).toEqual([]);
  });

  it('only uses metorial rules for metorial: names', () => {
    let candidates = select({
      target: { kind: 'metorial' },
      connections: [connection({ id: 'pc_anthropic', providerSlug: 'anthropic' })],
      rules: [rule({ slug: 'rr_1', providerSlug: 'azure' })]
    });

    expect(candidates.map(candidate => connectionOf(candidate))).toEqual(['pc_rr_1']);
  });

  it('drops metorial rules when the instance disabled the metorial provider', () => {
    expect(
      select({ metorialEnabled: false, rules: [rule({ slug: 'rr', providerSlug: 'azure' })] })
    ).toEqual([]);
  });

  it('ranks model rules over lab rules, then by priority', () => {
    let candidates = select({
      rules: [
        rule({ slug: 'rr_lab_high', providerSlug: 'anthropic', priority: 100 }),
        rule({
          slug: 'rr_model',
          providerSlug: 'azure',
          labSlug: null,
          modelSlug: sonnet.slug
        }),
        rule({ slug: 'rr_lab_low', providerSlug: 'anthropic', priority: 1 })
      ]
    });

    expect(candidates.map(candidate => ruleOf(candidate))).toEqual([
      'rr_model',
      'rr_lab_high',
      'rr_lab_low'
    ]);
  });

  it('ignores rules for other labs or models and rules whose provider lacks an offering', () => {
    let candidates = select({
      rules: [
        rule({ slug: 'rr_openai', providerSlug: 'openai', labSlug: 'openai' }),
        rule({
          slug: 'rr_other_model',
          providerSlug: 'azure',
          labSlug: null,
          modelSlug: 'anthropic/claude-opus-5'
        }),
        rule({ slug: 'rr_no_offering', providerSlug: 'openai' })
      ]
    });

    expect(candidates).toEqual([]);
  });

  it('splits tied rules by weight', () => {
    let rules = [
      rule({ slug: 'rr_light', providerSlug: 'anthropic', weight: 1 }),
      rule({ slug: 'rr_heavy', providerSlug: 'azure', weight: 9 })
    ];

    let counts = { rr_light: 0, rr_heavy: 0 };
    let seed = 1;
    let random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    for (let i = 0; i < 2000; i++) {
      let first = ruleOf(select({ rules, random })[0]!) as keyof typeof counts;
      counts[first]++;
    }

    expect(counts.rr_heavy / 2000).toBeGreaterThan(0.85);
    expect(counts.rr_light).toBeGreaterThan(0);
  });

  it('uses each platform connection once even when several rules point at it', () => {
    let candidates = select({
      rules: [
        rule({
          slug: 'rr_model',
          providerSlug: 'azure',
          connectionSlug: 'pc_azure',
          labSlug: null,
          modelSlug: sonnet.slug
        }),
        rule({ slug: 'rr_lab', providerSlug: 'azure', connectionSlug: 'pc_azure' })
      ]
    });

    expect(candidates.map(candidate => ruleOf(candidate))).toEqual(['rr_model']);
  });

  it('bills metorial routes at the underlying price unless the rule overrides it', () => {
    let [plain] = select({ rules: [rule({ slug: 'rr', providerSlug: 'azure' })] });
    let [overridden] = select({
      rules: [rule({ slug: 'rr', providerSlug: 'azure', pricingOverride: pricing(4) })]
    });

    expect(plain).toMatchObject({
      billedProviderSlug: 'metorial',
      providerSlug: 'azure',
      billedPricingSource: 'offering',
      billedPricing: pricing(3.3),
      providerPricing: pricing(3.3)
    });
    expect(overridden).toMatchObject({
      billedPricingSource: 'routing_rule',
      billedPricing: pricing(4),
      providerPricing: pricing(3.3)
    });
  });

  it('applies customer pricing overrides, preferring an exact model price', () => {
    let [plain, scaled, exact] = select({
      target: { kind: 'provider', providerSlug: 'anthropic' },
      connections: [
        connection({ id: 'pc_plain', providerSlug: 'anthropic', priority: 3 }),
        connection({
          id: 'pc_scaled',
          providerSlug: 'anthropic',
          priority: 2,
          pricingOverride: { multiplier: 0.5 }
        }),
        connection({
          id: 'pc_exact',
          providerSlug: 'anthropic',
          priority: 1,
          pricingOverride: { multiplier: 0.5, models: { [sonnet.slug]: pricing(2) } }
        })
      ]
    });

    expect(plain).toMatchObject({
      billedPricingSource: 'offering',
      billedPricing: pricing(3)
    });
    expect(scaled).toMatchObject({
      billedPricingSource: 'connection',
      billedPricing: pricing(1.5),
      providerPricing: pricing(1.5)
    });
    expect(exact).toMatchObject({
      billedPricingSource: 'connection',
      billedPricing: pricing(2),
      providerPricing: pricing(2)
    });
  });

  it('only uses connections and rules with every required feature enabled', () => {
    let candidates = select({
      requiredFeatures: ['zdr'],
      connections: [
        connection({ id: 'pc_plain', providerSlug: 'anthropic' }),
        connection({ id: 'pc_zdr', providerSlug: 'azure', features: { zdr: true } }),
        connection({ id: 'pc_zdr_off', providerSlug: 'azure', features: { zdr: false } })
      ],
      rules: [
        rule({ slug: 'rr_plain', providerSlug: 'anthropic' }),
        rule({ slug: 'rr_zdr', providerSlug: 'azure', features: { zdr: true } })
      ]
    });

    expect(candidates.map(candidate => connectionOf(candidate))).toEqual([
      'pc_zdr',
      'pc_rr_zdr'
    ]);
  });
});

describe('isModelAllowed', () => {
  let check = (allowedModels: string[], requested: string, modelSlug = requested) =>
    isModelAllowed({ allowedModels, requested, modelSlug });

  it('allows everything without restrictions', () => {
    expect(check([], 'anything')).toBe(true);
    expect(check(['*'], 'anything')).toBe(true);
  });

  it('matches exact names against the request or the resolved slug', () => {
    expect(check(['anthropic/claude-sonnet-5'], 'claude-sonnet-5', sonnet.slug)).toBe(true);
    expect(check(['openai:gpt-6'], 'openai:gpt-6', 'openai/gpt-6')).toBe(true);
    expect(check(['openai/gpt-6'], 'anthropic/claude-sonnet-5')).toBe(false);
  });

  it('supports trailing wildcards', () => {
    expect(check(['anthropic/*'], 'claude-sonnet-latest', sonnet.slug)).toBe(true);
    expect(check(['anthropic/*'], 'openai/gpt-6')).toBe(false);
  });
});
