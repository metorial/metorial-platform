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
import { Button, Menu, Spacer, Text } from '@metorial/ui';
import { useMemo, useState } from 'react';
import { groupMarketplaceManagers, pluginsFromMarketplace } from './groupManagers';
import { MarketplaceManagersTable } from './managersTable';
import { showMarketplaceManagerPanel } from './panel';
import { MARKETPLACE_MANAGER_COPY } from './types';

export { MarketplaceManagerScopeBadges, removeMarketplaceManager } from './shared';

let MarketplaceManagersForPortal = (props: {
  instanceId: string;
  portalId: string;
  skillMarketplaceId: string;
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

    return marketplace.data ? pluginsFromMarketplace(marketplace.data, { includeArchived: true }) : [];
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

  let isLoading =
    marketplace.isLoading ||
    marketplacePlugins.isLoading ||
    marketplaceAccess.isLoading ||
    pluginAccess.isLoading ||
    groups.isLoading ||
    profiles.isLoading;
  let error =
    marketplace.error ||
    marketplacePlugins.error ||
    marketplaceAccess.error ||
    pluginAccess.error ||
    groups.error ||
    profiles.error;

  return (
    <MarketplaceManagersTable
      instanceId={props.instanceId}
      rows={rows}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyState="No Marketplace Managers yet."
    />
  );
};

export let MarketplaceManagersList = (props: {
  instanceId: string;
  skillMarketplaceId: string;
  portalId?: string;
}) => {
  let portals = usePortals(props.instanceId, { limit: 50 });
  let [revision, setRevision] = useState(0);
  let portalItems = portals.data?.items ?? [];
  let activePortals = props.portalId
    ? portalItems.filter(portal => portal.id == props.portalId)
    : portalItems;

  return (
    <PageHeaderSection
      title="Marketplace Managers"
      description={MARKETPLACE_MANAGER_COPY}
      actions={
        <Menu
          items={[
            {
              id: 'group',
              label: 'Group',
              description: 'Grant management access to a group.'
            },
            {
              id: 'account',
              label: 'Account',
              description: 'Grant a single person access.'
            }
          ]}
          onItemClick={id => {
            if (id != 'group' && id != 'account') return;
            showMarketplaceManagerPanel({
              instanceId: props.instanceId,
              skillMarketplaceId: props.skillMarketplaceId,
              portalId:
                props.portalId ?? (portalItems.length == 1 ? portalItems[0]?.id : undefined),
              subjectMode: id,
              onSuccess: () => setRevision(value => value + 1)
            });
          }}
        >
          <Button size="2">Add Marketplace Manager</Button>
        </Menu>
      }
    >
      {renderWithLoader({ portals })(() =>
        activePortals.length ? (
          <>
            {activePortals.map(portal => (
              <div key={portal.id}>
                {activePortals.length > 1 ? (
                  <>
                    <Text size="2" weight="strong">
                      {portal.name}
                    </Text>
                    <Spacer size={10} />
                  </>
                ) : null}
                <MarketplaceManagersForPortal
                  key={`${portal.id}:${revision}`}
                  instanceId={props.instanceId}
                  portalId={portal.id}
                  skillMarketplaceId={props.skillMarketplaceId}
                />
                {activePortals.length > 1 ? <Spacer size={20} /> : null}
              </div>
            ))}
          </>
        ) : (
          <Text size="2" color="gray600">
            Create a portal before assigning Marketplace Managers.
          </Text>
        )
      )}
    </PageHeaderSection>
  );
};
