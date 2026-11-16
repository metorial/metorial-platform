import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildCatalog, createNameLookup, type BuildResult, type Offering } from '../src';
import { ensureModelsDevRepo } from '../src/sources/modelsDev';

let minResolvedShare = 0.9;
let maxFirstPartyUnresolvedShare = 0.1;
let minSdkResolvedShare = 0.8;

let result: BuildResult;

let live = (offerings: Offering[]) =>
  offerings.filter(offering => offering.status !== 'retired');

beforeAll(async () => {
  let modelsDevPath = await ensureModelsDevRepo({
    repoPath: process.env.MODEL_CATALOG_MODELS_DEV,
    cacheDir: path.join(import.meta.dirname, '..', '.cache')
  });

  result = await buildCatalog({ modelsDevPath, previousDir: null, offline: false });
});

describe('real data', () => {
  it('loads every source and validates', () => {
    expect(result.catalog.sources.filter(source => source.status !== 'fresh')).toEqual([]);
    expect(result.validation.errors).toEqual([]);
  });

  it('resolves most offerings', () => {
    let offerings = live(result.catalog.offerings);
    let resolved = offerings.filter(offering => offering.resolution.method !== 'unresolved');

    expect(resolved.length / offerings.length).toBeGreaterThanOrEqual(minResolvedShare);
  });

  it('resolves almost every first-party offering', () => {
    let firstParty = new Set(
      result.catalog.vendors.filter(vendor => vendor.kind === 'first-party').map(v => v.id)
    );
    let offerings = live(result.catalog.offerings).filter(offering =>
      firstParty.has(offering.vendorId)
    );
    let unresolved = offerings.filter(offering => offering.resolution.method === 'unresolved');

    expect(unresolved.length / offerings.length).toBeLessThanOrEqual(
      maxFirstPartyUnresolvedShare
    );
  });

  it('groups the Claude Opus line into one family', () => {
    let family = result.catalog.families.find(item => item.id === 'anthropic/claude-opus');

    expect(family?.modelIds.length).toBeGreaterThanOrEqual(5);
    expect(family?.modelIds.every(id => id.startsWith('anthropic/claude-opus-'))).toBe(true);
    expect(family?.modelIds).toContain('anthropic/claude-opus-4.5');
  });

  it('builds the expected major families', () => {
    let families = new Set(result.catalog.families.map(family => family.id));

    for (let id of [
      'anthropic/claude-sonnet',
      'anthropic/claude-haiku',
      'openai/gpt-sol',
      'openai/gpt-terra',
      'openai/gpt-luna',
      'google/gemini-pro',
      'google/gemini-flash',
      'deepseek/deepseek-r'
    ])
      expect(families.has(id), id).toBe(true);
  });

  it('keeps snapshot dates out of model ids for snapshot labs', () => {
    let dated = result.catalog.models.filter(
      model =>
        ['anthropic', 'openai'].includes(model.labId) &&
        /-20\d{6}$|-20\d\d-\d\d-\d\d$/.test(model.id)
    );

    expect(dated.map(model => model.id)).toEqual([]);
  });

  it('maps the same model on different vendors to one id', () => {
    let lookup = createNameLookup(result.catalog);
    let modelOf = (raw: string, namespace: string) => {
      let target = lookup(raw, namespace);
      return target && 'modelId' in target ? target.modelId : null;
    };

    expect(modelOf('claude-sonnet-4-5-20250929', 'vendor:anthropic')).toBe(
      'anthropic/claude-sonnet-4.5'
    );
    expect(modelOf('anthropic/claude-sonnet-4.5', 'vendor:openrouter')).toBe(
      'anthropic/claude-sonnet-4.5'
    );
    expect(modelOf('claude-sonnet-4-5@20250929', 'vendor:google-vertex')).toBe(
      'anthropic/claude-sonnet-4.5'
    );
  });

  it('resolves the AI SDK model ids of the major labs', () => {
    for (let pkg of ['@ai-sdk/anthropic', '@ai-sdk/openai', '@ai-sdk/google']) {
      let names = result.catalog.names.filter(name => name.namespace === `sdk:${pkg}`);
      let resolved = names.filter(name => name.target.kind !== 'unresolved');

      expect(names.length, pkg).toBeGreaterThan(0);
      expect(resolved.length / names.length, pkg).toBeGreaterThanOrEqual(minSdkResolvedShare);
    }
  });

  it('resolves every models.dev lab file name', () => {
    let unresolved = result.catalog.names.filter(
      name => name.namespace === 'catalog:models.dev' && name.target.kind === 'unresolved'
    );

    expect(unresolved).toEqual([]);
  });
});
