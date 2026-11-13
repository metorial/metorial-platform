import { describe, expect, it } from 'vitest';
import { createCatalogIndex, targetAt, vendorFor } from '../lookup';
import { fixtureCatalog, pointerSwitch } from './fixture';

let index = createCatalogIndex(fixtureCatalog);

let before = new Date('2025-07-01T00:00:00.000Z');
let after = new Date('2025-10-15T00:00:00.000Z');

describe('createCatalogIndex', () => {
  it('matches a vendor model id exactly', () => {
    let result = index.resolveModel({
      raw: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      at: after
    });

    expect(result.modelId).toBe('claude-sonnet-4-5');
    expect(result.offering?.id).toBe('anthropic:claude-sonnet-4-5');
  });

  it('uses the provider vendor for the offering', () => {
    let exact = index.resolveModel({
      raw: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
      provider: 'bedrock',
      at: after
    });
    expect(exact.offering?.id).toBe('aws-bedrock:claude-sonnet-4-5');

    let byName = index.resolveModel({
      raw: 'claude-sonnet-4-5-20250929',
      provider: 'bedrock',
      at: after
    });
    expect(byName.modelId).toBe('claude-sonnet-4-5');
    expect(byName.offering?.id).toBe('aws-bedrock:claude-sonnet-4-5');
  });

  it('falls back to the client family vendor and then to the first-party vendor', () => {
    expect(
      index.resolveModel({
        raw: 'claude-sonnet-4-5-20250929',
        family: 'claude-code',
        at: after
      }).offering?.id
    ).toBe('anthropic:claude-sonnet-4-5');

    expect(
      index.resolveModel({ raw: 'claude-sonnet-4-5-20250929', provider: 'gateway', at: after })
        .offering?.id
    ).toBe('anthropic:claude-sonnet-4-5');

    expect(index.resolveModel({ raw: 'gpt-5', family: 'codex', at: after }).offering?.id).toBe(
      'openai:gpt-5'
    );
  });

  it('evaluates pointers at the request time', () => {
    expect(index.resolveModel({ raw: 'claude-sonnet-latest', at: before }).modelId).toBe(
      'claude-sonnet-4'
    );
    expect(index.resolveModel({ raw: 'claude-sonnet-latest', at: after }).modelId).toBe(
      'claude-sonnet-4-5'
    );
  });

  it('prefers the default serving variant', () => {
    let result = index.resolveModel({
      raw: 'Claude Sonnet Latest',
      provider: 'anthropic',
      at: after
    });

    expect(result.offering?.id).toBe('anthropic:claude-sonnet-4-5');
  });

  it('leaves ambiguous and unknown names unresolved', () => {
    expect(index.resolveModel({ raw: 'sonnet', at: after })).toEqual({});
    expect(
      index.resolveModel({ raw: 'mystery-model', provider: 'openai', at: after })
    ).toEqual({});
  });
});

describe('modelInfo', () => {
  it('reports the family, lifecycle and whether the model is its family latest', () => {
    expect(index.modelInfo('claude-sonnet-4-5')).toEqual({
      familyId: 'claude-sonnet',
      status: 'active',
      isLatest: true
    });
    expect(index.modelInfo('claude-sonnet-4')).toEqual({
      familyId: 'claude-sonnet',
      status: 'deprecated',
      isLatest: false
    });
    expect(index.modelInfo('gpt-5')).toEqual({ status: 'active', isLatest: false });
    expect(index.modelInfo('unknown')).toBeUndefined();
  });
});

describe('targetAt', () => {
  let entry = fixtureCatalog.pointers[0]!;

  it('picks the period that contains the time', () => {
    expect(targetAt(entry, new Date(pointerSwitch))).toEqual({
      kind: 'model',
      modelId: 'claude-sonnet-4-5'
    });
    expect(targetAt(entry, before)).toEqual({ kind: 'model', modelId: 'claude-sonnet-4' });
  });

  it('uses the earliest period before history starts', () => {
    expect(targetAt(entry, new Date('2020-01-01T00:00:00.000Z'))).toEqual({
      kind: 'model',
      modelId: 'claude-sonnet-4'
    });
  });
});

describe('vendorFor', () => {
  it('maps providers and families to catalog vendors', () => {
    expect(vendorFor({ provider: 'vertex' })).toBe('google-vertex');
    expect(vendorFor({ provider: 'other:mistral' })).toBe('mistral');
    expect(vendorFor({ family: 'gemini-cli' })).toBe('google-ai-studio');
    expect(vendorFor({ family: 'cursor' })).toBeUndefined();
  });
});
