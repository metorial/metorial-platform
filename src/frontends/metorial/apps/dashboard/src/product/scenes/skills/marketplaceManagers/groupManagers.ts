import type {
  MarketplaceManagerAccess,
  MarketplaceManagerRow,
  MarketplacePluginOption
} from './types';

export let pluginsFromMarketplace = (
  marketplace: {
    plugins?: {
      status: string;
      identifier: string;
      skillPlugin?: { id: string; name?: string | null } | null;
    }[];
  },
  opts?: { includeArchived?: boolean }
): MarketplacePluginOption[] =>
  (marketplace.plugins ?? [])
    .filter(
      plugin =>
        plugin.skillPlugin &&
        (opts?.includeArchived
          ? plugin.status == 'active' || plugin.status == 'archived'
          : plugin.status == 'active')
    )
    .map(plugin => ({
      id: plugin.skillPlugin!.id,
      name: plugin.skillPlugin!.name || plugin.identifier
    }));

export let groupMarketplaceManagers = (d: {
  portalId: string;
  skillMarketplaceId: string;
  marketplaceAccesses: MarketplaceManagerAccess[] | null | undefined;
  pluginAccesses: MarketplaceManagerAccess[] | null | undefined;
  plugins: MarketplacePluginOption[];
  defaultGroupIds: Set<string>;
  profiles: {
    id: string;
    name: string;
    email: string;
    personalGroupId?: string;
  }[];
}): MarketplaceManagerRow[] => {
  let pluginById = new Map(d.plugins.map(plugin => [plugin.id, plugin]));
  let profileByPersonalGroupId = new Map(
    d.profiles
      .filter(profile => profile.personalGroupId)
      .map(profile => [profile.personalGroupId!, profile])
  );
  let byGroup = new Map<
    string,
    {
      consumerGroupId: string;
      name: string;
      description: string | null;
      marketplaceAccessId?: string;
      pluginAccesses: { pluginId: string; accessId: string }[];
    }
  >();

  let ensureGroup = (access: MarketplaceManagerAccess) => {
    let current = byGroup.get(access.consumerGroup.id);
    if (current) return current;

    current = {
      consumerGroupId: access.consumerGroup.id,
      name: access.consumerGroup.name,
      description: access.consumerGroup.description,
      pluginAccesses: []
    };
    byGroup.set(access.consumerGroup.id, current);
    return current;
  };

  for (let access of d.marketplaceAccesses ?? []) {
    if (access.access.type != 'skill_marketplace') continue;
    if (access.accessLevel != 'manage') continue;
    ensureGroup(access).marketplaceAccessId = access.id;
  }

  for (let access of d.pluginAccesses ?? []) {
    if (access.access.type != 'skill_plugin') continue;
    let pluginId = access.access.skillPlugin.id;
    if (!pluginById.has(pluginId)) continue;
    ensureGroup(access).pluginAccesses.push({ pluginId, accessId: access.id });
  }

  return [...byGroup.values()]
    .map(group => {
      let profile = profileByPersonalGroupId.get(group.consumerGroupId);
      let kind: MarketplaceManagerRow['kind'] = d.defaultGroupIds.has(group.consumerGroupId)
        ? 'group'
        : 'account';

      return {
        id: `${d.portalId}:${d.skillMarketplaceId}:${group.consumerGroupId}`,
        portalId: d.portalId,
        consumerGroupId: group.consumerGroupId,
        skillMarketplaceId: d.skillMarketplaceId,
        name: profile?.name || group.name,
        description: profile?.email || group.description,
        kind,
        accountId: profile?.id,
        scope: group.marketplaceAccessId
          ? { type: 'entire' as const }
          : {
              type: 'plugins' as const,
              plugins: group.pluginAccesses
                .map(pluginAccess => pluginById.get(pluginAccess.pluginId))
                .filter(Boolean) as MarketplacePluginOption[]
            },
        marketplaceAccessId: group.marketplaceAccessId,
        pluginAccesses: group.pluginAccesses
      };
    })
    .filter(row => row.scope.type == 'entire' || row.scope.plugins.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
};

export let groupManagersByMarketplace = (d: {
  portalId: string;
  consumerGroupId: string;
  kind: MarketplaceManagerRow['kind'];
  accountId?: string;
  groupDescription: string | null;
  accesses: MarketplaceManagerAccess[] | null | undefined;
  marketplaces: {
    id: string;
    name: string;
    description?: string | null;
    plugins: MarketplacePluginOption[];
  }[];
}): MarketplaceManagerRow[] => {
  let marketplaceByPluginId = new Map<string, string[]>();
  let marketplaceById = new Map(d.marketplaces.map(marketplace => [marketplace.id, marketplace]));

  for (let marketplace of d.marketplaces) {
    for (let plugin of marketplace.plugins) {
      let current = marketplaceByPluginId.get(plugin.id) ?? [];
      current.push(marketplace.id);
      marketplaceByPluginId.set(plugin.id, current);
    }
  }

  let byMarketplace = new Map<
    string,
    {
      skillMarketplaceId: string;
      marketplaceAccessId?: string;
      pluginAccesses: { pluginId: string; accessId: string }[];
    }
  >();

  let ensureMarketplace = (skillMarketplaceId: string) => {
    let current = byMarketplace.get(skillMarketplaceId);
    if (current) return current;
    current = { skillMarketplaceId, pluginAccesses: [] };
    byMarketplace.set(skillMarketplaceId, current);
    return current;
  };

  for (let access of d.accesses ?? []) {
    if (access.consumerGroup.id != d.consumerGroupId) continue;

    if (access.access.type == 'skill_marketplace') {
      if (access.accessLevel != 'manage') continue;
      ensureMarketplace(access.access.skillMarketplace.id).marketplaceAccessId = access.id;
      continue;
    }

    if (access.access.type != 'skill_plugin') continue;
    let pluginId = access.access.skillPlugin.id;
    for (let skillMarketplaceId of marketplaceByPluginId.get(pluginId) ?? []) {
      ensureMarketplace(skillMarketplaceId).pluginAccesses.push({
        pluginId,
        accessId: access.id
      });
    }
  }

  return [...byMarketplace.values()]
    .map(group => {
      let marketplace = marketplaceById.get(group.skillMarketplaceId);
      let pluginById = new Map(
        (marketplace?.plugins ?? []).map(plugin => [plugin.id, plugin])
      );

      return {
        id: `${d.portalId}:${group.skillMarketplaceId}:${d.consumerGroupId}`,
        portalId: d.portalId,
        consumerGroupId: d.consumerGroupId,
        skillMarketplaceId: group.skillMarketplaceId,
        name: marketplace?.name || group.skillMarketplaceId,
        description: marketplace?.description ?? d.groupDescription,
        kind: d.kind,
        accountId: d.accountId,
        scope: group.marketplaceAccessId
          ? { type: 'entire' as const }
          : {
              type: 'plugins' as const,
              plugins: group.pluginAccesses
                .map(pluginAccess => pluginById.get(pluginAccess.pluginId))
                .filter(Boolean) as MarketplacePluginOption[]
            },
        marketplaceAccessId: group.marketplaceAccessId,
        pluginAccesses: group.pluginAccesses
      };
    })
    .filter(row => row.scope.type == 'entire' || row.scope.plugins.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
};
