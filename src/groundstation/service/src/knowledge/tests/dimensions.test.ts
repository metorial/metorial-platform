import { describe, expect, it } from 'vitest';
import { testDimensionMaps } from '../../facts/tests/dimensionMaps';

describe('createDimensionMaps', () => {
  it('indexes models, latest models and vendor kinds', () => {
    let maps = testDimensionMaps();

    expect(maps.version).toBe('gks_test');
    expect(maps.models.get('llama-4')).toEqual({
      labId: 'meta',
      familyId: 'llama',
      kind: 'chat',
      status: 'active',
      openWeights: true
    });
    expect([...maps.latestModelIds].sort()).toEqual([
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'llama-4'
    ]);
    expect(maps.vendorKinds.get('aws-bedrock')).toBe('cloud');
  });

  it('maps client families to agents by normalized alias, preferring live agents', () => {
    let maps = testDimensionMaps();

    expect(maps.agentOf('claude-code')).toBe('claude-code');
    expect(maps.agentOf('Claude_Code')).toBe('claude-code');
    expect(maps.agentOf('other:codex_cli_rs')).toBe('codex');
    expect(maps.agentOf('codex')).toBe('codex');
    expect(maps.agentOf('cursor')).toBeNull();
  });

  it('parses lab hints from namespaces and Bedrock ids through lab aliases only', () => {
    let maps = testDimensionMaps();

    expect(maps.labHintOf('anthropic/claude-future-9')).toBe('anthropic');
    expect(maps.labHintOf('meta-llama/llama-9-70b')).toBe('meta');
    expect(maps.labHintOf('us.anthropic.claude-future-9-v1:0')).toBe('anthropic');
    expect(maps.labHintOf('aws/some-model')).toBeNull();
    expect(maps.labHintOf('mystery-model')).toBeNull();
    expect(maps.labHintOf('anthropic/claude-future-9')).toBe('anthropic');
  });
});
