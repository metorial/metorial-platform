import type {
  MarketplaceSerializerInput,
  PluginSerializerInput,
  PruneScope,
  SkillSerializerInput
} from './types';

export let marketplacePluginsDir = 'plugins';
export let pluginSkillsDir = 'skills';
export let pluginAgentsDir = 'agents';
export let pluginAssetsDir = 'assets';

export let marketplaceManifestPaths = {
  codex: '.agents/plugins/marketplace.json',
  claude: '.claude-plugin/marketplace.json',
  github: '.github/plugin/marketplace.json',
  cursor: '.cursor-plugin/marketplace.json'
};

export let pluginManifestPaths = {
  mcp: 'mcp.json',
  dotMcp: '.mcp.json',
  copilot: 'plugin.json',
  claude: '.claude-plugin/plugin.json',
  cursor: '.cursor-plugin/plugin.json',
  codex: '.codex-plugin/plugin.json'
};

export let getPluginLogoPath = (extension: string) => `${pluginAssetsDir}/logo.${extension}`;

export let getPluginAgentPath = (slug: string) => `${pluginAgentsDir}/${slug}.md`;

export let getPluginPath = (d: PluginSerializerInput) =>
  d.skillMarketplacePlugin
    ? `${marketplacePluginsDir}/${d.skillMarketplacePlugin.pluginSlug}`
    : undefined;

export let getSkillPath = (d: SkillSerializerInput) => {
  let inner = `${pluginSkillsDir}/${d.skillPluginSkill.pluginSkillSlug}`;

  let pluginPath = getPluginPath(d);
  if (pluginPath) return `${pluginPath}/${inner}`;

  return inner;
};

export let getSkillPruneScope = (input: SkillSerializerInput): PruneScope => ({
  prefix: getSkillPath(input),
  excludePrefixes: []
});

export let getPluginPruneScope = (input: PluginSerializerInput): PruneScope => ({
  prefix: getPluginPath(input) ?? '',
  excludePrefixes: [pluginSkillsDir]
});

export let getMarketplacePruneScope = (_input: MarketplaceSerializerInput): PruneScope => ({
  prefix: '',
  excludePrefixes: [marketplacePluginsDir]
});
