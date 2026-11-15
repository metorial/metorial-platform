import path from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  canonicalize,
  collectSourceFiles,
  type ModelMerge
} from '../src/pipeline/canonicalize';
import { buildModelsDevOfferings } from '../src/pipeline/offerings';
import { buildOrganizations } from '../src/pipeline/organizations';
import { createResolver } from '../src/pipeline/resolver';
import { buildVendors } from '../src/pipeline/vendors';
import type { OfferingOverride } from '../src/overrides';
import { readModelsDev } from '../src/sources/modelsDev';

export let fixturePath = path.join(import.meta.dirname, 'fixtures', 'models.dev');

export let now = '2026-01-01T00:00:00.000Z';

export let buildFixture = async (
  opts: { merges?: ModelMerge[]; overrides?: OfferingOverride[] } = {}
) => {
  let snapshot = await readModelsDev(fixturePath);
  let orgs = buildOrganizations(snapshot);
  let vendors = buildVendors(snapshot, orgs);
  let catalog = canonicalize(collectSourceFiles(snapshot, orgs, vendors), orgs, opts.merges);
  let resolver = createResolver(catalog, orgs, vendors, opts.overrides);
  let offerings = buildModelsDevOfferings(snapshot, vendors, catalog, resolver, now);

  return { snapshot, orgs, vendors, catalog, resolver, offerings };
};

export let resolveOrg = (alias: string) =>
  ({
    anthropic: 'anthropic',
    openai: 'openai',
    google: 'google',
    meta: 'meta',
    'meta-llama': 'meta'
  })[alias] ?? null;

export let noOverrides = { merges: [], offerings: [], models: [], families: [] };

export let readPricingFixture = async (kind: string): Promise<unknown> => {
  let json = [
    'cerebras',
    'deepinfra',
    'novita',
    'huggingface',
    'llmgateway',
    'venice',
    'mistral'
  ].includes(kind);
  let raw = await readFile(
    path.join(
      import.meta.dirname,
      '..',
      'src',
      'sources',
      kind,
      'fixtures',
      `response.${json ? 'json' : 'md'}`
    ),
    'utf8'
  );
  return json ? JSON.parse(raw) : raw;
};
