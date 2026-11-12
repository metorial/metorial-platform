import { describe, expect, it } from 'vitest';
import { canonicalSlug, dottedVersions } from '../src/pipeline/canonicalize';
import { buildFixture, resolveOrg } from './helpers';

describe('dottedVersions', () => {
  it('joins dashed version numbers', () => {
    expect(dottedVersions('claude-3-5-sonnet')).toBe('claude-3.5-sonnet');
    expect(dottedVersions('claude-opus-4-0')).toBe('claude-opus-4');
    expect(dottedVersions('llama-3-70b')).toBe('llama-3-70b');
  });
});

describe('canonicalSlug', () => {
  it('turns snapshot dates into releases for snapshot labs', () => {
    expect(canonicalSlug('claude-opus-4-5-20251101', 'anthropic', resolveOrg)).toMatchObject({
      slug: 'claude-opus-4.5',
      releaseDate: '2025-11-01',
      isLatest: false
    });
    expect(canonicalSlug('gpt-4o-2024-08-06', 'openai', resolveOrg)).toMatchObject({
      slug: 'gpt-4o',
      releaseDate: '2024-08-06'
    });
  });

  it('keeps dates in the slug for version labs', () => {
    expect(
      canonicalSlug('qwen3-coder-480b-a35b-instruct-2507', 'alibaba', resolveOrg)
    ).toMatchObject({
      slug: 'qwen3-coder-480b-a35b-instruct-2507',
      releaseDate: null
    });
  });

  it('flags latest aliases', () => {
    expect(canonicalSlug('claude-3-5-haiku-latest', 'anthropic', resolveOrg)).toMatchObject({
      slug: 'claude-3.5-haiku',
      isLatest: true
    });
  });
});

describe('canonicalize', () => {
  it('builds models, releases, pointers and families from lab files', async () => {
    let { catalog } = await buildFixture();

    expect([...catalog.models.keys()].sort()).toEqual([
      'anthropic/claude-3.5-haiku',
      'anthropic/claude-opus-4.1',
      'anthropic/claude-opus-4.5',
      'anthropic/claude-sonnet-4',
      'anthropic/claude-sonnet-4.5',
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro',
      'openai/gpt-4o',
      'openai/gpt-4o-mini-transcribe'
    ]);
    expect(catalog.releases.get('anthropic/claude-opus-4.5@2025-11-01')?.modelId).toBe(
      'anthropic/claude-opus-4.5'
    );
    expect(catalog.releases.has('openai/gpt-4o@2024-08-06')).toBe(true);
    expect(catalog.pointers.get('anthropic/claude-3.5-haiku-latest')?.target).toEqual({
      kind: 'model',
      modelId: 'anthropic/claude-3.5-haiku'
    });

    let opus = catalog.families.get('anthropic/claude-opus');
    expect(opus?.modelIds).toEqual(['anthropic/claude-opus-4.1', 'anthropic/claude-opus-4.5']);
    expect(opus?.latestModelId).toBe('anthropic/claude-opus-4.5');
    expect(catalog.families.get('anthropic/claude-sonnet')?.modelIds).toHaveLength(2);
  });

  it('applies merges', async () => {
    let { catalog } = await buildFixture({
      merges: [{ into: 'anthropic/claude-sonnet-4.5', from: ['anthropic/claude-sonnet-4'] }]
    });

    expect(catalog.models.has('anthropic/claude-sonnet-4')).toBe(false);
    expect(catalog.families.get('anthropic/claude-sonnet')?.modelIds).toEqual([
      'anthropic/claude-sonnet-4.5'
    ]);
  });
});
