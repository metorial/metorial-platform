import { describe, expect, it } from 'vitest';
import {
  getLegacyMarketplaceVersionHash,
  getMarketplaceVersionHash,
  renderMarketplaceFiles,
  type MarketplacePlugin
} from './render';

let plugin = (pluginSlug: string, description: string | null = `${pluginSlug} plugin`) =>
  ({
    pluginSlug,
    skillPlugin: {
      category: null,
      description,
      skillPluginSkills: [{ skill: { description: 'First skill' } }]
    }
  }) satisfies MarketplacePlugin;

let marketplace = {
  slug: 'acme',
  name: 'Acme',
  description: 'Acme skills',
  forceSyncCounter: 0
};

let input = {
  skillMarketplace: marketplace,
  ownerName: 'Acme Inc',
  plugins: [plugin('alpha'), plugin('beta')]
};

describe('renderMarketplaceFiles', () => {
  it('renders byte-identical files for the same input', () => {
    expect(renderMarketplaceFiles({ ...input, version: '0.0.3' })).toEqual(
      renderMarketplaceFiles({ ...input, version: '0.0.3' })
    );
  });

  it('keeps the plugin order it was given and writes the version into the metadata', () => {
    let files = renderMarketplaceFiles({ ...input, version: '0.0.3' });
    let claude = JSON.parse(files.find(file => file.path.includes('.claude-plugin'))!.content);

    expect(files.map(file => file.path)).toHaveLength(4);
    expect(claude.metadata).toEqual({ description: 'Acme skills', version: '0.0.3' });
    expect(claude.plugins.map((p: { name: string }) => p.name)).toEqual(['alpha', 'beta']);
  });

  it('falls back to the first skill description for plugins without one', () => {
    let files = renderMarketplaceFiles({
      ...input,
      plugins: [plugin('alpha', null)],
      version: '0.0.1'
    });
    let cursor = JSON.parse(files.at(-1)!.content);

    expect(cursor.plugins[0].description).toBe('First skill');
  });
});

describe('getMarketplaceVersionHash', () => {
  it('is stable for the same rendered output', async () => {
    expect(await getMarketplaceVersionHash(input)).toBe(
      await getMarketplaceVersionHash(input)
    );
  });

  it('changes when rendered content changes, including the description', async () => {
    let base = await getMarketplaceVersionHash(input);

    expect(
      await getMarketplaceVersionHash({
        ...input,
        skillMarketplace: { ...marketplace, description: 'New description' }
      })
    ).not.toBe(base);
    expect(await getMarketplaceVersionHash({ ...input, plugins: [plugin('alpha')] })).not.toBe(
      base
    );
    expect(await getMarketplaceVersionHash({ ...input, ownerName: 'Other' })).not.toBe(base);
  });

  it('changes when a sync is forced', async () => {
    expect(
      await getMarketplaceVersionHash({
        ...input,
        skillMarketplace: { ...marketplace, forceSyncCounter: 1 }
      })
    ).not.toBe(await getMarketplaceVersionHash(input));
  });

  it('differs from the legacy input hash so stored versions are adopted once', async () => {
    expect(await getMarketplaceVersionHash(input)).not.toBe(
      await getLegacyMarketplaceVersionHash(input)
    );
  });
});
