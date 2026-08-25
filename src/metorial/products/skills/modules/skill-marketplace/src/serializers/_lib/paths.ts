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

/** A skill owns its entire subtree, so anything it did not write is stale. */
export let getSkillPruneScope = (input: SkillSerializerInput): PruneScope => ({
  prefix: getSkillPath(input),
  excludePrefixes: []
});

/**
 * A plugin owns its own directory, but its skills are written by separate skill
 * tasks and must survive a plugin sync.
 */
export let getPluginPruneScope = (input: PluginSerializerInput): PruneScope => ({
  prefix: getPluginPath(input) ?? '',
  excludePrefixes: ['skills']
});

/**
 * A marketplace owns the repository root, but every plugin directory is written
 * by a separate plugin task.
 */
export let getMarketplacePruneScope = (_input: MarketplaceSerializerInput): PruneScope => ({
  prefix: '',
  excludePrefixes: ['plugins']
});
