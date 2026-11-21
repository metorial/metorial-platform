import type { PlatformConnectionDefinition } from '@mtsrc/ai-gateway-module-credentials';
import { describe, expect, it } from 'vitest';
import { routingRule, validateRoutingRules } from '../src/lib/definitions/routingRule';

let connection = (slug: string): PlatformConnectionDefinition => ({
  slug,
  providerSlug: slug,
  name: slug,
  priority: 0,
  credentials: { apiKey: 'key' },
  config: {},
  features: {}
});

let anthropic = connection('anthropic');
let azure = connection('azure');

describe('routingRule', () => {
  it('targets a lab with defaults', () => {
    expect(
      routingRule({ slug: 'anthropic-direct', lab: 'anthropic', via: anthropic })
    ).toEqual({
      slug: 'anthropic-direct',
      labSlug: 'anthropic',
      modelSlug: null,
      connection: anthropic,
      priority: 0,
      weight: 1,
      pricingOverride: null
    });
  });

  it('targets a single model', () => {
    let rule = routingRule({
      slug: 'sonnet-via-azure',
      model: 'anthropic/claude-sonnet-5',
      via: azure,
      priority: 5,
      weight: 3
    });

    expect(rule).toMatchObject({
      labSlug: null,
      modelSlug: 'anthropic/claude-sonnet-5',
      priority: 5,
      weight: 3
    });
  });

  it('rejects invalid slugs, priorities and weights', () => {
    expect(() => routingRule({ slug: 'Bad Slug', lab: 'openai', via: azure })).toThrow(
      /kebab-case/
    );
    expect(() => routingRule({ slug: 'a', lab: 'openai', via: azure, priority: 1.5 })).toThrow(
      /integer priority/
    );
    expect(() => routingRule({ slug: 'a', lab: 'openai', via: azure, weight: 0 })).toThrow(
      /weight/
    );
  });
});

describe('validateRoutingRules', () => {
  it('rejects duplicate rule slugs', () => {
    let rule = routingRule({ slug: 'anthropic-direct', lab: 'anthropic', via: anthropic });

    expect(() =>
      validateRoutingRules({ rules: [rule, rule], connections: [anthropic] })
    ).toThrow(/defined twice/);
  });

  it('rejects rules that route via an undefined platform connection', () => {
    let rule = routingRule({ slug: 'openai-via-azure', lab: 'openai', via: azure });

    expect(() => validateRoutingRules({ rules: [rule], connections: [anthropic] })).toThrow(
      /not a defined platform connection/
    );
  });

  it('accepts rules whose connections are all defined', () => {
    let rules = [
      routingRule({ slug: 'anthropic-direct', lab: 'anthropic', via: anthropic }),
      routingRule({ slug: 'openai-via-azure', lab: 'openai', via: azure })
    ];

    expect(() =>
      validateRoutingRules({ rules, connections: [anthropic, azure] })
    ).not.toThrow();
  });
});
