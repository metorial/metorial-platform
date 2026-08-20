import { useDeletePortalConsumerAccess } from '@metorial/state';
import { Badge, Flex, toast } from '@metorial/ui';
import type { MarketplaceManagerRow } from './types';

export let MarketplaceManagerScopeBadges = (props: { row: MarketplaceManagerRow }) => {
  if (props.row.scope.type == 'entire') {
    return (
      <Badge color="orange" size="1">
        Entire marketplace
      </Badge>
    );
  }

  let plugins = props.row.scope.plugins;
  let visible = plugins.slice(0, 3);
  let extra = plugins.length - visible.length;

  return (
    <Flex gap={6} wrap="wrap">
      {visible.map(plugin => (
        <Badge key={plugin.id} color="blue" size="1">
          {plugin.name}
        </Badge>
      ))}
      {extra > 0 ? (
        <Badge color="blue" size="1">
          +{extra}
        </Badge>
      ) : null}
    </Flex>
  );
};

export let removeMarketplaceManager = async (d: {
  instanceId: string;
  portalId: string;
  row: MarketplaceManagerRow;
  deleteAccess: ReturnType<typeof useDeletePortalConsumerAccess>;
}) => {
  let accessIds = d.row.marketplaceAccessId
    ? [d.row.marketplaceAccessId]
    : d.row.pluginAccesses.map(item => item.accessId);

  for (let consumerAccessId of accessIds) {
    let [, error] = await d.deleteAccess.mutate({
      instanceId: d.instanceId,
      portalId: d.portalId,
      consumerAccessId
    });
    if (error) return false;
  }

  toast.success('Marketplace Manager removed');
  return true;
};
