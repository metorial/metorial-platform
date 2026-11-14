import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

let { db, downloadImage } = vi.hoisted(() => ({
  db: {
    skillPlugin: { updateMany: vi.fn(async () => ({ count: 1 })) },
    skillMarketplace: { updateMany: vi.fn(async () => ({ count: 1 })) }
  },
  downloadImage: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/config', () => ({
  getConfig: () => ({ urls: { apiUrl: 'https://api.metorial.test' } })
}));
vi.mock('@metorial/skills-images', () => ({ internalImageService: { downloadImage } }));
vi.mock('../../../lib/securityReviewPolicy', () => ({ getWithheldSkillIds: async () => new Set<string>() }));
vi.mock('../../../lib/limits', () => ({}));

import { getManifestScopeViolation, scopeContains } from '../../../lib/manifestFile/scope';
import { getSkillPath } from '../../../serializers/_lib/paths';
import type {
  MarketplaceSerializerInput,
  PluginSerializerInput,
  SerializerContext,
  SkillSerializerInput
} from '../../../serializers/_lib/types';
import { applyMarketplace } from '../../../serializers/marketplace';
import { applyPlugin } from '../../../serializers/plugin';
import {
  getMarketplaceManifestScope,
  getPluginManifestScope,
  getSkillDestinationKind,
  getSkillDestinationManifestScope
} from './scope';

let logoExtensions = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'ico'];
let pluginSlugs = ['acme', 'odd-slug_1', 'émoji-🚀', 'a.b'];
let agentSlugs = ['reviewer', 'code-review.v2', 'x'];

let createRecorder = () => {
  let paths: string[] = [];
  let basePath = '';
  let resolve = (inPath: string) => path.posix.join('/', basePath, inPath).replace(/^\/+/, '');

  let context: SerializerContext = {
    setFile: async inPath => void paths.push(resolve(inPath)),
    setFileFromStorage: async inPath => void paths.push(resolve(inPath)),
    deletePath: async () => {},
    setBasePath: inPath => {
      basePath = inPath ?? '';
    }
  };

  return { paths, context };
};

let skillPlugin = (slug: string) => ({
  oid: 1n,
  id: `skpl_${slug}`,
  slug,
  name: `Plugin ${slug}`,
  description: 'A plugin',
  longDescription: null,
  category: null,
  version: null,
  versionHash: null,
  updatedAt: new Date(0)
});

let renderPlugin = async (d: { slug: string; extension: string; inMarketplace: boolean }) => {
  downloadImage.mockResolvedValue({
    extension: d.extension,
    fetch: async () => Buffer.from('')
  });
  let recorder = createRecorder();

  let input = {
    skillPlugin: skillPlugin(d.slug),
    ...(d.inMarketplace
      ? {
          skillMarketplace: { slug: 'market', forceSyncCounter: 0 },
          skillMarketplacePlugin: { pluginSlug: d.slug }
        }
      : {})
  } as unknown as PluginSerializerInput;

  await applyPlugin.apply(input, recorder.context, {
    skills: [],
    project: { organization: { name: 'Acme', image: null } },
    agents: agentSlugs.map(slug => ({ slug, document: { content: { content: '# agent' } } })),
    image: null,
    hash: 'hash',
    versionHash: 'version-hash'
  } as any);

  return recorder.paths;
};

let renderMarketplace = async () => {
  let recorder = createRecorder();

  let input = {
    skillMarketplace: {
      oid: 1n,
      slug: 'market',
      name: 'Market',
      description: null,
      forceSyncCounter: 0,
      version: null,
      versionHash: null,
      updatedAt: new Date(0)
    }
  } as unknown as MarketplaceSerializerInput;

  await applyMarketplace.apply(input, recorder.context, {
    plugins: pluginSlugs.map(pluginSlug => ({
      pluginSlug,
      skillPlugin: { category: null, description: null, skillPluginSkills: [] }
    })),
    project: { organization: { name: 'Acme', image: null } },
    hash: 'hash'
  } as any);

  return recorder.paths;
};

let skillPath = (pluginSlug: string, skillSlug: string, inMarketplace: boolean) =>
  getSkillPath({
    skillPluginSkill: { pluginSkillSlug: skillSlug },
    ...(inMarketplace ? { skillMarketplacePlugin: { pluginSlug } } : {})
  } as unknown as SkillSerializerInput);

let userOwnedPaths = [
  'README.md',
  'LICENSE',
  'assets/banner.png',
  'assets/logo/x.png',
  'agents/notes.txt',
  'agents/nested/reviewer.md',
  'docs/x.md',
  '.github/workflows/ci.yml',
  '.gitattributes',
  '.gitmodules',
  '.git/config',
  'skills/.git/config',
  'plugins/acme/.gitattributes'
];

describe('managed manifest scope', () => {
  it('is valid under the shared path rules', () => {
    expect(getManifestScopeViolation(getMarketplaceManifestScope())).toBeNull();
    expect(getManifestScopeViolation(getPluginManifestScope())).toBeNull();
  });

  it('covers everything the marketplace serializer and its plugins and skills write', async () => {
    let scope = getMarketplaceManifestScope();
    let paths = await renderMarketplace();

    for (let slug of pluginSlugs) {
      for (let extension of logoExtensions) {
        paths.push(...(await renderPlugin({ slug, extension, inMarketplace: true })));
      }
      paths.push(`${skillPath(slug, 'qa', true)}/SKILL.md`);
      paths.push(`${skillPath(slug, 'deep', true)}/references/nested/doc.md`);
    }

    expect(paths.length).toBeGreaterThan(100);
    expect(paths.filter(p => !scopeContains(scope, p))).toEqual([]);
  });

  it('covers everything a standalone or managed plugin writes', async () => {
    let scope = getPluginManifestScope();
    let paths: string[] = [];

    for (let extension of logoExtensions) {
      paths.push(...(await renderPlugin({ slug: 'acme', extension, inMarketplace: false })));
    }
    paths.push(`${skillPath('acme', 'qa', false)}/SKILL.md`);
    paths.push(`${skillPath('acme', 'odd slug', false)}/scripts/run.sh`);

    expect(paths).toContain('.claude-plugin/marketplace.json');
    expect(paths).toContain('agents/code-review.v2.md');
    expect(paths.filter(p => !scopeContains(scope, p))).toEqual([]);
  });

  it.each(userOwnedPaths)('leaves user-owned %s alone', p => {
    expect(scopeContains(getMarketplaceManifestScope(), p)).toBe(false);
    expect(scopeContains(getPluginManifestScope(), p)).toBe(false);
  });

  it('picks the scope from the destination owner', () => {
    expect(getSkillDestinationKind({ skillMarketplace: {}, skillPlugin: null })).toBe(
      'marketplace'
    );
    expect(getSkillDestinationKind({ skillMarketplace: null, skillPlugin: {} })).toBe(
      'plugin'
    );
    expect(() => getSkillDestinationKind({})).toThrow();
    expect(getSkillDestinationManifestScope('plugin')).toEqual(getPluginManifestScope());
  });
});
