import { describe, expect, it } from 'vitest';
import {
  parseModelName,
  resolveModelName,
  type AliasRef,
  type ModelNameSource,
  type ModelRef
} from '../src/lib/modelName';

let providers = new Set(['openai', 'anthropic', 'google-ai-studio', 'azure']);

describe('parseModelName', () => {
  it('treats plain names as unified names', () => {
    expect(parseModelName('anthropic/claude-sonnet-5', providers)).toEqual({
      kind: 'unified',
      raw: 'anthropic/claude-sonnet-5',
      name: 'anthropic/claude-sonnet-5'
    });
  });

  it('pins a provider with a known provider prefix', () => {
    expect(parseModelName('openai:gpt-6', providers)).toMatchObject({
      kind: 'pinned',
      providerSlug: 'openai',
      vendorModelId: 'gpt-6'
    });
    expect(parseModelName('Google-AI-Studio:gemini-3-pro', providers)).toMatchObject({
      kind: 'pinned',
      providerSlug: 'google-ai-studio',
      vendorModelId: 'gemini-3-pro'
    });
  });

  it('keeps colons inside the vendor model id', () => {
    expect(parseModelName('azure:deployment:v2', providers)).toMatchObject({
      kind: 'pinned',
      providerSlug: 'azure',
      vendorModelId: 'deployment:v2'
    });
  });

  it('does not split on unknown prefixes', () => {
    expect(parseModelName('llama3:70b', providers)).toMatchObject({
      kind: 'unified',
      name: 'llama3:70b'
    });
    expect(parseModelName('anthropic.claude-v2:1', providers).kind).toBe('unified');
  });

  it('routes metorial: names through the metorial provider', () => {
    expect(parseModelName('metorial:anthropic/claude-sonnet-5', providers)).toEqual({
      kind: 'metorial',
      raw: 'metorial:anthropic/claude-sonnet-5',
      name: 'anthropic/claude-sonnet-5'
    });
  });

  it('ignores an empty name after the prefix', () => {
    expect(parseModelName('openai:', providers).kind).toBe('unified');
  });
});

let source = (d: {
  models: ModelRef[];
  aliases?: (AliasRef & { raw: string; key: string })[];
  offerings?: { providerSlug: string; vendorModelId: string; modelSlug: string }[];
}): ModelNameSource => {
  let model = (slug: string) => d.models.find(model => model.slug == slug) ?? null;

  return {
    modelBySlug: async slug => model(slug),
    aliasesByRaw: async raw => (d.aliases ?? []).filter(alias => alias.raw == raw),
    aliasesByKey: async key => (d.aliases ?? []).filter(alias => alias.key == key),
    modelOfOffering: async q => {
      let offering = (d.offerings ?? []).find(
        offering =>
          offering.providerSlug == q.providerSlug && offering.vendorModelId == q.vendorModelId
      );

      return offering ? model(offering.modelSlug) : null;
    }
  };
};

let sonnet = { slug: 'anthropic/claude-sonnet-5', labSlug: 'anthropic' };
let oldSonnet = { slug: 'anthropic/claude-sonnet-4', labSlug: 'anthropic' };
let gpt = { slug: 'openai/gpt-6', labSlug: 'openai' };

describe('resolveModelName', () => {
  it('matches model slugs case-insensitively', async () => {
    let resolved = await resolveModelName(
      parseModelName('Anthropic/Claude-Sonnet-5', providers),
      source({ models: [sonnet] })
    );

    expect(resolved).toEqual({ model: sonnet, via: 'slug' });
  });

  it('falls back to aliases by raw name, then by normalized key', async () => {
    let models = source({
      models: [sonnet, gpt],
      aliases: [
        {
          namespace: 'vendor:anthropic',
          raw: 'claude-sonnet-5',
          key: 'claude-sonnet-5',
          modelSlug: sonnet.slug
        },
        {
          namespace: 'catalog:litellm',
          raw: 'openai/gpt-6.0',
          key: 'openai/gpt-6-0',
          modelSlug: gpt.slug
        }
      ]
    });

    expect(
      await resolveModelName(parseModelName('claude-sonnet-5', providers), models)
    ).toEqual({ model: sonnet, via: 'alias' });
    expect(
      await resolveModelName(parseModelName('OpenAI/GPT_6.0', providers), models)
    ).toEqual({
      model: gpt,
      via: 'key'
    });
  });

  it('prefers the metorial namespace, then the lab namespace, over resellers', async () => {
    let aliases = [
      {
        namespace: 'vendor:openrouter',
        raw: 'claude-sonnet',
        key: 'claude-sonnet',
        modelSlug: oldSonnet.slug
      },
      {
        namespace: 'vendor:anthropic',
        raw: 'claude-sonnet',
        key: 'claude-sonnet',
        modelSlug: sonnet.slug
      }
    ];

    let resolved = await resolveModelName(
      parseModelName('claude-sonnet', providers),
      source({ models: [sonnet, oldSonnet], aliases })
    );
    expect(resolved?.model).toEqual(sonnet);

    let withMetorial = await resolveModelName(
      parseModelName('claude-sonnet', providers),
      source({
        models: [sonnet, oldSonnet],
        aliases: [
          ...aliases,
          {
            namespace: 'metorial',
            raw: 'claude-sonnet',
            key: 'claude-sonnet',
            modelSlug: oldSonnet.slug
          }
        ]
      })
    );
    expect(withMetorial?.model).toEqual(oldSonnet);
  });

  it('resolves pinned names through the provider offering first', async () => {
    let resolved = await resolveModelName(
      parseModelName('anthropic:claude-sonnet-5-20261001', providers),
      source({
        models: [sonnet],
        offerings: [
          {
            providerSlug: 'anthropic',
            vendorModelId: 'claude-sonnet-5-20261001',
            modelSlug: sonnet.slug
          }
        ]
      })
    );

    expect(resolved).toEqual({ model: sonnet, via: 'offering' });
  });

  it('resolves pinned unified names when the provider id is not an offering id', async () => {
    let resolved = await resolveModelName(
      parseModelName('azure:openai/gpt-6', providers),
      source({ models: [gpt] })
    );

    expect(resolved).toEqual({ model: gpt, via: 'slug' });
  });

  it('returns null for unknown names', async () => {
    expect(
      await resolveModelName(parseModelName('nope', providers), source({ models: [sonnet] }))
    ).toBeNull();
  });
});
