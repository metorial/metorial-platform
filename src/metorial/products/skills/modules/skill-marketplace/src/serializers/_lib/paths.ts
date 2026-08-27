import type {
  MarketplaceSerializerInput,
  PluginSerializerInput,
  PruneScope,
  SkillSerializerInput
} from './types';

export let getPluginPath = (d: PluginSerializerInput) =>
  d.skillMarketplacePlugin ? `plugins/${d.skillMarketplacePlugin.pluginSlug}` : undefined;

export let getSkillPath = (d: SkillSerializerInput) => {
  let inner = `skills/${d.skillPluginSkill.pluginSkillSlug}`;

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
  excludePrefixes: ['skills']
});

export let getMarketplacePruneScope = (_input: MarketplaceSerializerInput): PruneScope => ({
  prefix: '',
  excludePrefixes: ['plugins']
});
