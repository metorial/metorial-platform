import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import type { SkillMarketplace } from '@metorial/db';
import { getMarketplaceForceSyncHashInput } from '../_lib/forceSync';
import { marketplaceManifestPaths, marketplacePluginsDir } from '../_lib/paths';

export type MarketplacePlugin = {
  pluginSlug: string;
  skillPlugin: {
    category: string | null;
    description: string | null;
    skillPluginSkills: { skill: { description: string | null } }[];
  };
};

type RenderedMarketplace = Pick<SkillMarketplace, 'slug' | 'name' | 'description'>;

let json = (data: any) => JSON.stringify(data, null, 2);

let getPluginCategory = (plugin: MarketplacePlugin) =>
  plugin.skillPlugin.category ?? 'Productivity';

let getPluginDescription = (plugin: MarketplacePlugin) =>
  plugin.skillPlugin.description ??
  plugin.skillPlugin.skillPluginSkills[0]?.skill.description ??
  '';

export let renderMarketplaceFiles = (d: {
  skillMarketplace: RenderedMarketplace;
  ownerName: string;
  version: string | null;
  plugins: MarketplacePlugin[];
}) => {
  let codexMarketplace = json({
    name: d.skillMarketplace.slug,
    interface: {
      displayName: d.skillMarketplace.name
    },
    plugins: d.plugins.map(p => ({
      name: p.pluginSlug,
      category: getPluginCategory(p),
      source: {
        source: 'local',
        path: `./${marketplacePluginsDir}/${p.pluginSlug}`
      },
      policy: {
        installation: 'AVAILABLE',
        authentication: 'ON_INSTALL'
      }
    }))
  });

  let claudeMarketplace = json({
    name: d.skillMarketplace.slug,
    owner: {
      name: d.ownerName
    },
    metadata: {
      description: d.skillMarketplace.description ?? '',
      version: d.version
    },
    plugins: d.plugins.map(p => ({
      name: p.pluginSlug,
      source: `./${marketplacePluginsDir}/${p.pluginSlug}`,
      description: getPluginDescription(p)
    }))
  });

  let cursorMarketplace = json({
    name: d.skillMarketplace.slug,
    owner: {
      name: d.ownerName
    },
    metadata: {
      description: d.skillMarketplace.description ?? '',
      version: d.version
    },
    plugins: d.plugins.map(p => ({
      name: p.pluginSlug,
      source: p.pluginSlug,
      description: getPluginDescription(p)
    }))
  });

  return [
    { path: marketplaceManifestPaths.codex, content: codexMarketplace },
    { path: marketplaceManifestPaths.claude, content: claudeMarketplace },
    { path: marketplaceManifestPaths.github, content: claudeMarketplace },
    { path: marketplaceManifestPaths.cursor, content: cursorMarketplace }
  ];
};

type VersionHashInput = {
  skillMarketplace: RenderedMarketplace & Pick<SkillMarketplace, 'forceSyncCounter'>;
  ownerName: string;
  plugins: MarketplacePlugin[];
};

export let getMarketplaceVersionHash = (d: VersionHashInput) =>
  Hash.sha256(
    canonicalize({
      ...getMarketplaceForceSyncHashInput(d.skillMarketplace),
      files: renderMarketplaceFiles({ ...d, version: null })
    })
  );

export let getLegacyMarketplaceVersionHash = (d: VersionHashInput) =>
  Hash.sha256(
    canonicalize({
      serializerVersion: 3,
      ...getMarketplaceForceSyncHashInput(d.skillMarketplace),
      marketplace: {
        slug: d.skillMarketplace.slug,
        name: d.skillMarketplace.name,
        ownerName: d.ownerName
      },
      plugins: d.plugins.map(plugin => ({
        slug: plugin.pluginSlug,
        category: getPluginCategory(plugin),
        description: getPluginDescription(plugin)
      }))
    })
  );
