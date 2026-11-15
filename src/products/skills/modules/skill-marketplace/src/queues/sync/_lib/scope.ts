import type { ManifestScope } from '../../../lib/manifestFile/scope';
import {
  getPluginAgentPath,
  getPluginLogoPath,
  marketplaceManifestPaths,
  marketplacePluginsDir,
  pluginManifestPaths,
  pluginSkillsDir
} from '../../../serializers/_lib/paths';

export type SkillDestinationKind = 'marketplace' | 'plugin';

export let getMarketplaceManifestScope = (): ManifestScope => ({
  dirs: [marketplacePluginsDir],
  files: Object.values(marketplaceManifestPaths),
  globs: []
});

// Standalone and managed plugins write their own marketplace JSONs next to the plugin ones.
export let getPluginManifestScope = (): ManifestScope => ({
  dirs: [pluginSkillsDir],
  files: [...Object.values(pluginManifestPaths), ...Object.values(marketplaceManifestPaths)],
  globs: [getPluginLogoPath('*'), getPluginAgentPath('*')]
});

export let getSkillDestinationManifestScope = (kind: SkillDestinationKind) =>
  kind == 'marketplace' ? getMarketplaceManifestScope() : getPluginManifestScope();

export let getSkillDestinationKind = (destination: {
  skillMarketplace?: unknown | null;
  skillPlugin?: unknown | null;
}): SkillDestinationKind => {
  if (destination.skillMarketplace) return 'marketplace';
  if (destination.skillPlugin) return 'plugin';
  throw new Error('Skill destination has neither a marketplace nor a plugin');
};
