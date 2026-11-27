import type { SkillMarketplacePlugin, SkillPlugin } from '@metorial/state';

export type EmbeddedPluginSkill = SkillPlugin['skills'][number];

export type MarketplaceSkillPlugin = Omit<
  NonNullable<SkillMarketplacePlugin['skillPlugin']>,
  'skills'
> & {
  skills: EmbeddedPluginSkill[];
  canUpdate?: boolean;
  canDelete?: boolean;
  canEditSkills?: boolean;
};

export type MarketplaceFilter = 'all' | 'plugins' | 'standalone';

export type MoveDestination = { type: 'plugin'; pluginId: string } | { type: 'standalone' };

export type SkillEntry = {
  skill: EmbeddedPluginSkill;
  item: SkillMarketplacePlugin;
  plugin: MarketplaceSkillPlugin;
  standalone: boolean;
  canMove: boolean;
  canRead: boolean;
};

export type SkillFlash = { skillIds: string[]; destination: MoveDestination };

export type PluginGroupView = {
  item: SkillMarketplacePlugin;
  plugin: MarketplaceSkillPlugin;
  skills: EmbeddedPluginSkill[];
  totalSkills: number;
};

let normalizeName = (value: string | null | undefined) => value?.trim().toLowerCase();

export let marketplaceCanCreatePlugins = (marketplace: {
  status: string;
  canCreatePlugins?: boolean;
}) => marketplace.canCreatePlugins ?? marketplace.status == 'active';

export let pluginCanUpdate = (plugin: { status: string; canUpdate?: boolean }) =>
  plugin.canUpdate ?? plugin.status == 'active';

export let isSkillGroupPlugin = (plugin: { source?: { type: string } }) =>
  plugin.source?.type === 'skill_group';

export let pluginCanEditSkills = (plugin: {
  status: string;
  canUpdate?: boolean;
  canEditSkills?: boolean;
  source?: { type: string };
}) => plugin.canEditSkills ?? (pluginCanUpdate(plugin) && !isSkillGroupPlugin(plugin));

export let pluginCanDelete = (plugin: { status: string; canDelete?: boolean }) =>
  plugin.canDelete === true;

export let getReadableSkillGroupId = (plugin: MarketplaceSkillPlugin) =>
  plugin.source.type === 'skill_group' && plugin.source.skillGroup.canRead
    ? plugin.source.skillGroup.id
    : undefined;

export let getPlugin = (item: SkillMarketplacePlugin) =>
  item.skillPlugin as MarketplaceSkillPlugin | null;

export let isCollapsedMarketplacePlugin = (item: SkillMarketplacePlugin) => {
  let plugin = item.skillPlugin;
  if (!plugin || plugin.skills.length !== 1 || isSkillGroupPlugin(plugin)) return false;

  let pluginNames = [plugin.name, item.identifier].map(normalizeName).filter(Boolean);
  let skill = plugin.skills[0].skill;
  let skillNames = [skill.name, skill.clientName, skill.slug]
    .map(normalizeName)
    .filter(Boolean);

  return skillNames.some(name => pluginNames.includes(name));
};

export let getMoveSkillInput = (skill: EmbeddedPluginSkill) => ({
  skillId: skill.skillId,
  identifier: skill.identifier,
  clientName: skill.clientName,
  clientDescription: skill.clientDescription,
  clientMetadata: skill.clientMetadata,
  license: skill.license,
  compatibility: skill.compatibility,
  skillConfigurationId: skill.skillConfigurationId
});

export let shouldDeleteSourcePluginAfterMove = (
  item: SkillMarketplacePlugin | undefined
): item is SkillMarketplacePlugin & { skillPlugin: SkillPlugin } =>
  Boolean(item && isCollapsedMarketplacePlugin(item));

export let pluginHasSkill = (plugin: { skills: { skillId: string }[] }, skillId: string) =>
  plugin.skills.some(skill => skill.skillId === skillId);

let withoutSkill = (
  item: SkillMarketplacePlugin,
  skill: EmbeddedPluginSkill,
  removeEmptySource: boolean
) => {
  let plugin = getPlugin(item)!;
  if (plugin.skills.length === 1 && removeEmptySource && isCollapsedMarketplacePlugin(item)) {
    return [];
  }

  return [
    {
      ...item,
      skillPlugin: {
        ...plugin,
        skills: plugin.skills.filter(current => current.id !== skill.id)
      }
    }
  ];
};

export let moveSkillOptimistically = (
  items: SkillMarketplacePlugin[],
  sourcePluginId: string,
  destinationPluginId: string,
  skill: EmbeddedPluginSkill,
  removeEmptySource = true
) =>
  items.flatMap(item => {
    let plugin = getPlugin(item);
    if (!plugin) return [item];
    if (plugin.id === sourcePluginId) return withoutSkill(item, skill, removeEmptySource);

    if (plugin.id === destinationPluginId && !pluginHasSkill(plugin, skill.skillId)) {
      return [{ ...item, skillPlugin: { ...plugin, skills: [...plugin.skills, skill] } }];
    }

    return [item];
  });

export let moveSkillToStandaloneOptimistically = (
  items: SkillMarketplacePlugin[],
  sourcePluginId: string,
  skill: EmbeddedPluginSkill,
  standalonePlugin: SkillMarketplacePlugin,
  removeEmptySource = true
) => [
  ...items.flatMap(item =>
    item.skillPlugin?.id === sourcePluginId
      ? withoutSkill(item, skill, removeEmptySource)
      : [item]
  ),
  standalonePlugin
];

export let removeSkillOptimistically = (
  items: SkillMarketplacePlugin[],
  pluginId: string,
  skill: EmbeddedPluginSkill
) =>
  items.flatMap(item =>
    item.skillPlugin?.id === pluginId ? withoutSkill(item, skill, false) : [item]
  );

export let removeMarketplacePluginsOptimistically = (
  items: SkillMarketplacePlugin[],
  marketplacePluginIds: string[]
) => items.filter(item => !marketplacePluginIds.includes(item.id));

export let asStandaloneMarketplacePlugin = (d: {
  plugin: SkillPlugin;
  skill: EmbeddedPluginSkill;
  skillMarketplaceId: string;
}): SkillMarketplacePlugin => ({
  object: 'skill.marketplace_plugin',
  id: `optimistic:${d.plugin.id}`,
  status: 'active',
  identifier: d.plugin.slug,
  skillConfigurationId: d.plugin.skillConfigurationId,
  skillMarketplaceId: d.skillMarketplaceId,
  skillPlugin: { ...d.plugin, skills: [d.skill] },
  createdAt: d.plugin.createdAt,
  updatedAt: d.plugin.updatedAt
});

export let asOptimisticStandaloneMarketplacePlugin = (d: {
  sourcePlugin: SkillPlugin;
  skill: EmbeddedPluginSkill;
  skillMarketplaceId: string;
}) =>
  asStandaloneMarketplacePlugin({
    plugin: {
      ...d.sourcePlugin,
      id: `optimistic-plugin:${d.skill.skillId}`,
      name: d.skill.skill.name,
      slug: d.skill.skill.slug,
      description: d.skill.skill.description,
      imageUrl: d.skill.skill.imageUrl,
      category: null,
      source: { type: 'manual' as const },
      skills: [d.skill]
    },
    skill: d.skill,
    skillMarketplaceId: d.skillMarketplaceId
  });

let compareNames = (
  aName: string | null | undefined,
  bName: string | null | undefined,
  aId: string,
  bId: string
) => {
  let byName = (aName ?? '').localeCompare(bName ?? '', undefined, {
    sensitivity: 'base',
    numeric: true
  });

  return byName || aId.localeCompare(bId);
};

let getSortName = (item: SkillMarketplacePlugin) =>
  isCollapsedMarketplacePlugin(item)
    ? item.skillPlugin!.skills[0].skill.name
    : (item.skillPlugin?.name ?? item.identifier);

export let sortMarketplacePluginHierarchy = (items: SkillMarketplacePlugin[]) =>
  items
    .map(item => ({
      ...item,
      skillPlugin: item.skillPlugin
        ? {
            ...item.skillPlugin,
            skills: [...item.skillPlugin.skills].sort((a, b) =>
              compareNames(a.skill.name, b.skill.name, a.skillId, b.skillId)
            )
          }
        : null
    }))
    .sort((a, b) => compareNames(getSortName(a), getSortName(b), a.id, b.id));

export let buildSkillIndex = (items: SkillMarketplacePlugin[]) => {
  let index = new Map<string, SkillEntry>();

  for (let item of items) {
    let plugin = getPlugin(item);
    if (!plugin) continue;

    let standalone = isCollapsedMarketplacePlugin(item);
    let canMove = pluginCanEditSkills(plugin) && !item.id.startsWith('optimistic');
    for (let skill of plugin.skills) {
      index.set(skill.id, {
        skill,
        item,
        plugin,
        standalone,
        canMove,
        canRead: skill.canRead !== false
      });
    }
  }

  return index;
};

let includesQuery = (query: string, values: (string | null | undefined)[]) =>
  values.some(value => value?.toLowerCase().includes(query));

let skillMatches = (skill: EmbeddedPluginSkill, query: string) =>
  includesQuery(query, [
    skill.skill.name,
    skill.skill.slug,
    skill.identifier,
    skill.clientName,
    skill.skill.description
  ]);

export let buildMarketplaceView = (
  items: SkillMarketplacePlugin[],
  opts: { search: string; filter: MarketplaceFilter }
) => {
  let query = opts.search.trim().toLowerCase();
  let groups: PluginGroupView[] = [];
  let standalone: SkillEntry[] = [];
  let counts = { plugins: 0, standalone: 0 };

  for (let item of items) {
    let plugin = getPlugin(item);
    if (!plugin) continue;

    if (isCollapsedMarketplacePlugin(item)) {
      counts.standalone++;
      if (opts.filter === 'plugins') continue;

      let skill = plugin.skills[0];
      if (query && !skillMatches(skill, query)) continue;

      standalone.push({
        skill,
        item,
        plugin,
        standalone: true,
        canMove: pluginCanEditSkills(plugin) && !item.id.startsWith('optimistic'),
        canRead: skill.canRead !== false
      });
      continue;
    }

    counts.plugins++;
    if (opts.filter === 'standalone') continue;

    let pluginMatches =
      !query ||
      includesQuery(query, [plugin.name, plugin.slug, plugin.category, item.identifier]);
    let skills = pluginMatches
      ? plugin.skills
      : plugin.skills.filter(skill => skillMatches(skill, query));
    if (!pluginMatches && !skills.length) continue;

    groups.push({ item, plugin, skills, totalSkills: plugin.skills.length });
  }

  return { groups, standalone, counts };
};

let relativeTimeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

let relativeTimeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60]
];

export let formatRelativeTime = (date: Date | string) => {
  let seconds = (new Date(date).getTime() - Date.now()) / 1000;

  for (let [unit, unitSeconds] of relativeTimeUnits) {
    if (Math.abs(seconds) >= unitSeconds) {
      return relativeTimeFormat.format(Math.round(seconds / unitSeconds), unit);
    }
  }

  return 'just now';
};
