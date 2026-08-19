import { PageHeaderSection } from '@metorial/layout';
import { useAllPortalConsumerAccess, useSkillMarketplaces } from '@metorial/state';
import { Button } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useMemo } from 'react';
import { groupManagersByMarketplace, pluginsFromMarketplace } from './groupManagers';
import { GroupMarketplaceManagersTable } from './managersTable';
import { showMarketplaceManagerPanel } from './panel';
import { MARKETPLACE_MANAGER_COPY } from './types';

export let GroupMarketplaceManagersList = (props: {
  instanceId: string;
  portalId: string;
  consumerGroupId: string;
  asBox?: boolean;
}) => {
  let marketplaces = useSkillMarketplaces(props.instanceId, {
    order: 'desc',
    status: ['active'],
    limit: 100
  });
  let accesses = useAllPortalConsumerAccess(props.instanceId, props.portalId, {
    consumerGroupId: props.consumerGroupId,
    type: ['skill_marketplace', 'skill_plugin'],
    limit: 100
  });

  let marketplaceOptions = useMemo(
    () =>
      (marketplaces.data?.items ?? []).map(marketplace => ({
        id: marketplace.id,
        name: marketplace.name,
        description: marketplace.description,
        plugins: pluginsFromMarketplace(marketplace)
      })),
    [marketplaces.data?.items]
  );

  let rows = useMemo(
    () =>
      groupManagersByMarketplace({
        portalId: props.portalId,
        consumerGroupId: props.consumerGroupId,
        kind: 'group',
        groupDescription: null,
        accesses: accesses.data,
        marketplaces: marketplaceOptions
      }),
    [accesses.data, marketplaceOptions, props.consumerGroupId, props.portalId]
  );

  let refetch = () => {
    accesses.refetch();
    marketplaces.refetch();
  };

  let inner = (
    <GroupMarketplaceManagersTable
      instanceId={props.instanceId}
      rows={rows}
      isLoading={marketplaces.isLoading || accesses.isLoading}
      error={marketplaces.error || accesses.error}
      refetch={refetch}
      emptyState="No marketplace management access yet."
    />
  );

  let actions = (
    <Button
      size="2"
      onClick={() =>
        showMarketplaceManagerPanel({
          instanceId: props.instanceId,
          portalId: props.portalId,
          consumerGroupId: props.consumerGroupId,
          subjectMode: 'group',
          onSuccess: refetch
        })
      }
    >
      Add Marketplace Manager
    </Button>
  );

  if (props.asBox) {
    return (
      <Box
        title="Marketplace Managers"
        description={MARKETPLACE_MANAGER_COPY}
        rightActions={actions}
      >
        {inner}
      </Box>
    );
  }

  return (
    <PageHeaderSection
      title="Marketplace Managers"
      description={MARKETPLACE_MANAGER_COPY}
      actions={actions}
    >
      {inner}
    </PageHeaderSection>
  );
};
