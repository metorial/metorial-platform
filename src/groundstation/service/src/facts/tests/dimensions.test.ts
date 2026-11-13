import { normalizeAgentKey } from '@metorial/model-catalog/src/pipeline/agents';
import { describe, expect, it } from 'vitest';
import {
  aliasKeyPattern,
  dimensionResolverOf,
  dimensionResolvers,
  type DimensionContext
} from '../dimensions';
import { testDimensionMaps } from './dimensionMaps';

let maps = testDimensionMaps();

let context = (unresolvedRaws: string[] = []): DimensionContext => ({ maps, unresolvedRaws });

let mapped = (field: string, value: string | null, raw: string | null = null) =>
  dimensionResolvers[field]!.map({ value, raw, maps });

let matched = (field: string, values: string[], unresolvedRaws?: string[]) =>
  dimensionResolvers[field]!.match(values, context(unresolvedRaws));

describe('dimension resolvers', () => {
  it('only knows its own fields', () => {
    expect(dimensionResolverOf('model.family')?.base).toBe('modelId');
    expect(dimensionResolverOf('vendor.kind')?.base).toBe('vendorId');
    expect(dimensionResolverOf('agent.maker')?.base).toBe('client.family');
    expect(dimensionResolverOf('model')).toBeUndefined();
    expect(dimensionResolverOf('constructor')).toBeUndefined();
  });

  it('maps model attributes and leaves unresolved models null', () => {
    expect(mapped('model.family', 'claude-sonnet-4-5')).toBe('claude-sonnet');
    expect(mapped('model.family', 'gpt-5')).toBeNull();
    expect(mapped('model.family', null)).toBeNull();
    expect(mapped('model.family', 'unknown-model')).toBeNull();

    expect(mapped('model.kind', 'text-embedding-3')).toBe('embedding');
    expect(mapped('model.status', 'claude-opus-4-1')).toBe('deprecated');
    expect(mapped('model.isLatest', 'claude-sonnet-4-5')).toBe('true');
    expect(mapped('model.isLatest', 'claude-opus-4-1')).toBe('false');
    expect(mapped('model.isLatest', null)).toBeNull();
    expect(mapped('model.openWeights', 'llama-4')).toBe('true');
    expect(mapped('model.openWeights', 'gpt-5')).toBe('false');
    expect(mapped('model.kind', null, 'anthropic/claude-x')).toBeNull();
  });

  it('maps the lab of a model and falls back to the lab hint of unresolved raws', () => {
    expect(mapped('model.lab', 'llama-4')).toBe('meta');
    expect(mapped('model.lab', null, 'anthropic/claude-future-9')).toBe('anthropic');
    expect(mapped('model.lab', null, 'mystery-model')).toBeNull();
    expect(mapped('model.lab', null, null)).toBeNull();
    expect(mapped('model.lab', 'unknown-model', 'anthropic/claude-future-9')).toBeNull();
    expect(dimensionResolvers['model.lab']!.groupsUnresolvedRaw).toBe(true);
  });

  it('maps vendors and agents', () => {
    expect(mapped('vendor.kind', 'aws-bedrock')).toBe('cloud');
    expect(mapped('vendor.kind', 'unknown-vendor')).toBeNull();
    expect(mapped('vendor.kind', null)).toBeNull();

    expect(mapped('agent', 'claude_code')).toBe('claude-code');
    expect(mapped('agent', 'cursor')).toBeNull();
    expect(mapped('agent', null)).toBeNull();
    expect(mapped('agent.maker', 'codex_cli_rs')).toBe('openai');
    expect(mapped('agent.maker', 'cursor')).toBeNull();
  });
});

describe('dimension filter expansion', () => {
  it('expands model attributes to the matching model ids', () => {
    expect(matched('model.family', ['claude-sonnet', 'llama'])).toEqual({
      modelId: { $in: ['claude-sonnet-4-5', 'llama-4'] }
    });
    expect(matched('model.family', ['nope'])).toEqual({ modelId: { $in: [] } });
    expect(matched('model.kind', ['embedding'])).toEqual({
      modelId: { $in: ['text-embedding-3'] }
    });
    expect(matched('model.status', ['deprecated'])).toEqual({
      modelId: { $in: ['claude-opus-4-1'] }
    });
    expect(matched('model.isLatest', ['false'])).toEqual({
      modelId: { $in: ['claude-opus-4-1', 'gpt-5', 'text-embedding-3'] }
    });
    expect(matched('model.openWeights', ['true'])).toEqual({ modelId: { $in: ['llama-4'] } });
  });

  it('adds unresolved raws whose lab hint matches to a lab filter', () => {
    expect(matched('model.lab', ['openai'])).toEqual({
      modelId: { $in: ['gpt-5', 'text-embedding-3'] }
    });
    expect(
      matched('model.lab', ['anthropic'], ['anthropic/claude-future-9', 'meta-llama/x', 'y'])
    ).toEqual({
      $or: [
        { modelId: { $in: ['claude-sonnet-4-5', 'claude-opus-4-1'] } },
        { modelId: null, modelRaw: { $in: ['anthropic/claude-future-9'] } }
      ]
    });
  });

  it('expands vendor kinds to vendor ids', () => {
    expect(matched('vendor.kind', ['cloud', 'aggregator'])).toEqual({
      vendorId: { $in: ['aws-bedrock', 'openrouter'] }
    });
  });

  it('expands agents and makers to patterns over every alias form', () => {
    let patternsOf = (filter: Record<string, unknown>) =>
      (filter['client.family'] as { $in: RegExp[] }).$in;

    let codex = patternsOf(matched('agent', ['codex']));
    expect(codex).toHaveLength(2);
    expect(
      ['codex', 'codex_cli_rs', 'CODEX-CLI-RS'].every(value =>
        codex.some(pattern => pattern.test(value))
      )
    ).toBe(true);
    expect(codex.some(pattern => pattern.test('claude-code'))).toBe(false);

    let anthropic = patternsOf(matched('agent.maker', ['anthropic']));
    expect(anthropic.map(String)).toEqual([String(aliasKeyPattern('claude-code'))]);
    expect(patternsOf(matched('agent.maker', ['nobody']))).toEqual([]);
  });
});

describe('aliasKeyPattern', () => {
  it('matches exactly the values that normalize to the key', () => {
    let candidates = [
      'claude-code',
      'claude_code',
      'Claude Code',
      'claude.code',
      ' claude-code ',
      'other:claude_code',
      'OTHER:Claude-Code',
      'claude__code',
      'claude--code',
      'claudecode',
      'claude-code-2',
      'x-claude-code',
      'claude-coder'
    ];

    let pattern = aliasKeyPattern('claude-code');

    for (let candidate of candidates) {
      expect([candidate, pattern.test(candidate)]).toEqual([
        candidate,
        normalizeAgentKey(candidate) == 'claude-code'
      ]);
    }
  });

  it('escapes regular expression characters in keys', () => {
    let pattern = aliasKeyPattern('a+b');

    expect(pattern.test('a+b')).toBe(true);
    expect(pattern.test('aab')).toBe(false);
  });
});
