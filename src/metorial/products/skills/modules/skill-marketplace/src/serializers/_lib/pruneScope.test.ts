import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  getMarketplacePruneScope,
  getPluginPath,
  getPluginPruneScope,
  getSkillPath,
  getSkillPruneScope
} from './paths';
import type {
  MarketplaceSerializerInput,
  PluginSerializerInput,
  PruneScope,
  SkillSerializerInput
} from './types';

// Mirrors the normalization process.ts applies before sending a prune to the
// code bucket.
let normalizeBucketPath = (inPath: string) => {
  if (!inPath) return '/';

  let segments = inPath.split('/').filter(segment => segment && segment !== '.');
  let normalized: string[] = [];

  for (let segment of segments) {
    if (segment === '..') normalized.pop();
    else normalized.push(segment);
  }

  return `/${normalized.join('/')}`;
};

let resolveScope = (scope: PruneScope) => ({
  prefix: normalizeBucketPath(scope.prefix),
  excludePrefixes: scope.excludePrefixes.map(exclude =>
    normalizeBucketPath(path.join(scope.prefix, exclude))
  )
});

let marketplaceInput = {
  skillMarketplace: { slug: 'acme-marketplace' }
} as unknown as MarketplaceSerializerInput;

let pluginInput = {
  skillPlugin: { slug: 'acme' },
  skillMarketplace: { slug: 'acme-marketplace' },
  skillMarketplacePlugin: { pluginSlug: 'acme' }
} as unknown as PluginSerializerInput;

let standalonePluginInput = {
  skillPlugin: { slug: 'acme' }
} as unknown as PluginSerializerInput;

let skillInput = {
  ...pluginInput,
  skill: { id: 'skl_1' },
  skillPluginSkill: { pluginSkillSlug: 'demo' }
} as unknown as SkillSerializerInput;

describe('serializer prune scopes', () => {
  it('lets a skill own its whole subtree', () => {
    let scope = resolveScope(getSkillPruneScope(skillInput));

    expect(scope.prefix).toBe('/plugins/acme/skills/demo');
    expect(scope.excludePrefixes).toEqual([]);
    expect(scope.prefix).toBe(normalizeBucketPath(getSkillPath(skillInput)));
  });

  it('keeps a plugin sync from deleting its skills', () => {
    let scope = resolveScope(getPluginPruneScope(pluginInput));

    expect(scope.prefix).toBe('/plugins/acme');
    expect(scope.excludePrefixes).toEqual(['/plugins/acme/skills']);

    // The skills a plugin's skill tasks write must sit inside the exclusion.
    let skillPath = normalizeBucketPath(getSkillPath(skillInput));
    expect(skillPath.startsWith(`${scope.excludePrefixes[0]}/`)).toBe(true);
  });

  it('scopes a standalone plugin to the root while still sparing skills', () => {
    let scope = resolveScope(getPluginPruneScope(standalonePluginInput));

    expect(getPluginPath(standalonePluginInput)).toBeUndefined();
    expect(scope.prefix).toBe('/');
    expect(scope.excludePrefixes).toEqual(['/skills']);
  });

  it('keeps a marketplace sync from deleting plugins', () => {
    let scope = resolveScope(getMarketplacePruneScope(marketplaceInput));

    expect(scope.prefix).toBe('/');
    expect(scope.excludePrefixes).toEqual(['/plugins']);

    let pluginPath = normalizeBucketPath(getPluginPath(pluginInput)!);
    expect(pluginPath.startsWith(`${scope.excludePrefixes[0]}/`)).toBe(true);
  });
});
