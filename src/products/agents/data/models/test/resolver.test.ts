import { describe, expect, it } from 'vitest';
import { buildFixture } from './helpers';

describe('resolver', () => {
  it('resolves vendor names to the same model and release', async () => {
    let { resolver } = await buildFixture();
    let resolve = (vendorId: string | null, vendorModelId: string) =>
      resolver.resolve({ vendorId, vendorModelId });

    expect(resolve('anthropic', 'claude-opus-4-5-20251101')).toMatchObject({
      method: 'first-party',
      target: { kind: 'release', releaseId: 'anthropic/claude-opus-4.5@2025-11-01' }
    });
    expect(
      resolve('aws-bedrock', 'us.anthropic.claude-opus-4-5-20251101-v1:0').target
    ).toMatchObject({
      releaseId: 'anthropic/claude-opus-4.5@2025-11-01'
    });
    expect(resolve('google-vertex', 'claude-opus-4-5@20251101').target).toMatchObject({
      releaseId: 'anthropic/claude-opus-4.5@2025-11-01'
    });
    expect(resolve(null, 'anthropic/claude-opus-4.5').target).toEqual({
      kind: 'model',
      modelId: 'anthropic/claude-opus-4.5'
    });
  });

  it('maps unknown snapshots of a known model to the model', async () => {
    let { resolver } = await buildFixture();
    let result = resolver.resolve({ vendorId: 'openai', vendorModelId: 'gpt-4o-2024-11-20' });

    expect(result.method).toBe('snapshot-date');
    expect(result.target).toEqual({ kind: 'model', modelId: 'openai/gpt-4o' });
  });

  it('resolves latest pointers, including synthesized family pointers', async () => {
    let { resolver, catalog } = await buildFixture();

    expect(
      resolver.resolve({ vendorId: null, vendorModelId: 'claude-3-5-haiku-latest' }).target
    ).toEqual({
      kind: 'pointer',
      pointerId: 'anthropic/claude-3.5-haiku-latest'
    });

    let family = resolver.resolve({
      vendorId: null,
      vendorModelId: 'anthropic/claude-opus-latest'
    });
    expect(family.method).toBe('pointer');
    expect(catalog.pointers.get('anthropic/claude-opus-latest')?.target).toEqual({
      kind: 'model',
      modelId: 'anthropic/claude-opus-4.5'
    });
  });

  it('matches reordered names structurally', async () => {
    let { resolver } = await buildFixture();
    let result = resolver.resolve({
      vendorId: 'snowflake-cortex',
      vendorModelId: 'claude-4-sonnet'
    });

    expect(result.method).toBe('structural');
    expect(result.target).toEqual({ kind: 'model', modelId: 'anthropic/claude-sonnet-4' });
  });

  it('recognizes routers and leaves unknown names unresolved', async () => {
    let { resolver } = await buildFixture();

    expect(
      resolver.resolve({ vendorId: 'openrouter', vendorModelId: 'openrouter/auto' }).method
    ).toBe('router');
    expect(
      resolver.resolve({ vendorId: 'openrouter', vendorModelId: 'acme/brand-new-9' }).method
    ).toBe('unresolved');
  });

  it('applies offering overrides first', async () => {
    let { resolver } = await buildFixture({
      overrides: [
        {
          id: 'test',
          vendorId: 'openrouter',
          vendorModelId: 'acme/brand-new-9',
          decision: 'link',
          target: { kind: 'model', modelId: 'openai/gpt-4o' },
          until: null,
          reason: 'test'
        }
      ]
    });

    expect(
      resolver.resolve({ vendorId: 'openrouter', vendorModelId: 'acme/brand-new-9' })
    ).toMatchObject({
      method: 'override',
      overrideId: 'test',
      target: { kind: 'model', modelId: 'openai/gpt-4o' }
    });
  });
});

describe('models.dev offerings', () => {
  it('links every fixture offering', async () => {
    let { offerings } = await buildFixture();
    let byId = Object.fromEntries(
      [...offerings.values()].map(offering => [offering.id, offering])
    );

    expect(byId['anthropic:claude-opus-4-5-20251101']).toMatchObject({
      releaseId: 'anthropic/claude-opus-4.5@2025-11-01',
      resolution: { method: 'base-model' }
    });
    expect(byId['aws-bedrock:us.anthropic.claude-sonnet-4-5-20250929-v1']).toMatchObject({
      modelId: 'anthropic/claude-sonnet-4.5',
      variant: { region: 'us' },
      pricing: { text: { input: 3.3, output: 16.5 } }
    });
    expect(byId['openrouter:openrouter/auto']?.kind).toBe('router');
    expect(byId['openrouter:google/gemini-2.5-flash']?.modelId).toBe(
      'google/gemini-2.5-flash'
    );
    expect(byId['openrouter:anthropic/claude-4-sonnet']?.modelId).toBe(
      'anthropic/claude-sonnet-4'
    );
  });
});
