import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeaderSection } from '@metorial/layout';
import {
  useAllPortalConsumerAccess,
  useAllSkillMarketplacePlugins,
  usePortalConsumerGroups,
  usePortalConsumerProfiles,
  usePortals,
  useSkillMarketplace
} from '@metorial/state';
import { Flex, Text } from '@metorial/ui';
import { useMemo } from 'react';
import { groupMarketplaceManagers, pluginsFromMarketplace } from './groupManagers';
import { MarketplaceManagerShareList } from './shareList';
import { MARKETPLACE_MANAGER_COPY } from './types';

export { MarketplaceManagerScopeBadges, removeMarketplaceManager } from './shared';

let MarketplaceManagersForPortal = (props: {
  instanceId: string;
  portalId: string;
  skillMarketplaceId: string;
  title: React.ReactNode;
}) => {
  let marketplace = useSkillMarketplace(props.instanceId, props.skillMarketplaceId);
  let marketplacePlugins = useAllSkillMarketplacePlugins(
    props.instanceId,
    props.skillMarketplaceId,
    {
      order: 'asc',
      status: ['active', 'archived']
    }
  );
  let plugins = useMemo(() => {
    if (marketplacePlugins.data?.length) {
      return marketplacePlugins.data
        .filter(plugin => plugin.skillPlugin)
        .map(plugin => ({
          id: plugin.skillPlugin!.id,
          name: plugin.skillPlugin!.name || plugin.identifier
        }));
    }

    return marketplace.data
      ? pluginsFromMarketplace(marketplace.data, { includeArchived: true })
      : [];
  }, [marketplace.data, marketplacePlugins.data]);
  let marketplaceAccess = useAllPortalConsumerAccess(props.instanceId, props.portalId, {
    type: 'skill_marketplace',
    skillMarketplaceId: props.skillMarketplaceId,
    limit: 100
  });
  let pluginAccess = useAllPortalConsumerAccess(props.instanceId, props.portalId, {
    type: 'skill_plugin',
    limit: 100
  });
  let groups = usePortalConsumerGroups(props.instanceId, props.portalId, {
    status: ['active'],
    limit: 100
  });
  let profiles = usePortalConsumerProfiles(props.instanceId, props.portalId, {
    limit: 100
  });

  let rows = useMemo(
    () =>
      groupMarketplaceManagers({
        portalId: props.portalId,
        skillMarketplaceId: props.skillMarketplaceId,
        marketplaceAccesses: marketplaceAccess.data,
        pluginAccesses: pluginAccess.data,
        plugins,
        defaultGroupIds: new Set((groups.data?.items ?? []).map(group => group.id)),
        profiles: (profiles.data?.items ?? []).map(profile => ({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          personalGroupId: (profile.groups ?? []).find(
            assignment => assignment.assignedVia == 'user'
          )?.group.id
        }))
      }),
    [
      groups.data?.items,
      marketplaceAccess.data,
      pluginAccess.data,
      plugins,
      profiles.data?.items,
      props.portalId,
      props.skillMarketplaceId
    ]
  );

  let refetch = () => {
    marketplace.refetch();
    marketplacePlugins.refetch();
    marketplaceAccess.refetch();
    pluginAccess.refetch();
    groups.refetch();
    profiles.refetch();
  };

  return renderWithLoader({
    marketplace,
    marketplacePlugins,
    marketplaceAccess,
    pluginAccess,
    groups,
    profiles
  })(() => (
    <MarketplaceManagerShareList
      instanceId={props.instanceId}
      portalId={props.portalId}
      skillMarketplaceId={props.skillMarketplaceId}
      title={props.title}
      rows={rows}
      refetch={refetch}
    />
  ));
};

export let MarketplaceManagersList = (props: {
  instanceId: string;
  skillMarketplaceId: string;
  portalId?: string;
}) => {
  let portals = usePortals(props.instanceId, { limit: 50 });
  let portalItems = portals.data?.items ?? [];
  let activePortals = props.portalId
    ? portalItems.filter(portal => portal.id == props.portalId)
    : portalItems;

  return (
    <PageHeaderSection title="Managers" description={MARKETPLACE_MANAGER_COPY}>
      {renderWithLoader({ portals })(() =>
        activePortals.length ? (
          <Flex direction="column" gap={20}>
            {activePortals.map(portal => (
              <MarketplaceManagersForPortal
                key={portal.id}
                instanceId={props.instanceId}
                portalId={portal.id}
                skillMarketplaceId={props.skillMarketplaceId}
                title={portal.name}
              />
            ))}
          </Flex>
        ) : (
          <Text size="2" color="gray600">
            Create a portal before assigning managers.
          </Text>
        )
      )}
    </PageHeaderSection>
  );
};
