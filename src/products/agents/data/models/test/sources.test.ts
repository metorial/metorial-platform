import { describe, expect, it } from 'vitest';
import { extractModelIds } from '../src/sources/aiSdk';
import { loadSource, perToken, perUnit } from '../src/sources/fetch';
import { parseOpenRouter } from '../src/sources/openrouter';
import { isRouterId } from '../src/pipeline/routers';
import { litellmVendorFor, stripLitellmRoute } from '../src/pipeline/names';

describe('extractModelIds', () => {
  it('reads only top-level literal union members', () => {
    let dts = `
      type AnthropicMessagesModelId = 'claude-opus-4-5' | 'claude-sonnet-4-5' | (string & {});
      type OpenAIChatModelId = "gpt-4o" | 'gpt-4o-mini';
      type OpenAIProviderSettingsModelId = { api: 'responses' | 'chat'; requestConfig: string };
    `;

    expect(extractModelIds(dts)).toEqual([
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'gpt-4o',
      'gpt-4o-mini'
    ]);
  });
});

describe('prices', () => {
  it('scales per-token strings to per-million and keeps units as given', () => {
    expect(perToken('0.000003')).toBe(3);
    expect(perToken('0.00000015')).toBe(0.15);
    expect(perToken('-1')).toBeNull();
    expect(perUnit('0.04')).toBe(0.04);
    expect(perUnit('')).toBeNull();
  });
});

describe('parseOpenRouter', () => {
  it('validates items one at a time', () => {
    let parsed = parseOpenRouter({
      data: [{ id: 'openai/gpt-4o', context_length: 128000 }, { id: 42 }]
    });

    expect(parsed.data.map(model => model.id)).toEqual(['openai/gpt-4o']);
    expect(parsed.issues).toHaveLength(1);
  });
});

describe('loadSource', () => {
  let base = {
    kind: 'openrouter' as const,
    ref: 'test',
    now: '2026-01-01T00:00:00.000Z',
    parse: (raw: unknown) => ({ data: raw, issues: [] })
  };

  it('marks a successful fetch fresh', async () => {
    let result = await loadSource({
      ...base,
      offline: false,
      previousDir: null,
      fetch: async () => ['a']
    });

    expect(result.meta.status).toBe('fresh');
    expect(result.data).toEqual(['a']);
  });

  it('reports a missing source when there is nothing to fall back to', async () => {
    let result = await loadSource({
      ...base,
      offline: false,
      previousDir: null,
      fetch: async () => {
        throw new Error('boom');
      }
    });

    expect(result.meta).toMatchObject({ status: 'missing', error: 'boom' });
    expect(result.data).toBeNull();
  });
});

describe('isRouterId', () => {
  it.each(['openrouter/auto', 'auto', 'liquid.auto', 'openrouter/free', 'smart-router'])(
    '%s is a router',
    id => {
      expect(isRouterId(id)).toBe(true);
    }
  );

  it.each(['gpt-4o', 'claude-auto-complete', 'anthropic/claude-opus-4.5'])(
    '%s is not a router',
    id => {
      expect(isRouterId(id)).toBe(false);
    }
  );
});

describe('LiteLLM keys', () => {
  it('strips the route and AWS region', () => {
    expect(stripLitellmRoute('bedrock/us-east-1/anthropic.claude-3-haiku-20240307-v1:0')).toBe(
      'anthropic.claude-3-haiku-20240307-v1:0'
    );
    expect(stripLitellmRoute('openrouter/anthropic/claude-opus-4.5')).toBe(
      'anthropic/claude-opus-4.5'
    );
    expect(stripLitellmRoute('gpt-4o')).toBe('gpt-4o');
  });

  it('maps providers to vendors', () => {
    expect(litellmVendorFor('vertex_ai-anthropic_models')).toBe('google-vertex');
    expect(litellmVendorFor('bedrock_converse')).toBe('aws-bedrock');
    expect(litellmVendorFor('unknown')).toBeNull();
  });
});
