import { renderWithPagination } from '@metorial/data-hooks';
import {
  type SkillMarketplace,
  skillMarketplacesLoader,
  useCreateSkillPlugin,
  useSkillMarketplaces
} from '@metorial/state';
import { Avatar, Badge, Button, Spacer, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { RiAddLine } from '@remixicon/react';
import styled from 'styled-components';
import { showPublishToMarketplacePanel } from './skillMarketplacePlugins/dialogs';

let publishedPageSize = 100;

let MarketplaceName = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

let EmptyState = styled.div`
  line-height: 1.6;
  padding: 8px 0;
`;

let getGroupPlugin = (marketplace: SkillMarketplace, skillGroupId: string) =>
  marketplace.plugins.find(
    item =>
      item.status === 'active' &&
      item.skillPlugin?.source.type === 'skill_group' &&
      item.skillPlugin.source.skillGroup.id === skillGroupId
  )?.skillPlugin;

export let SkillGroupMarketplacesScene = (p: {
  instanceId: string;
  skillGroupId: string;
  skillGroupName: string;
  getSkillMarketplacePath?: (skillMarketplaceId: string) => string;
}) => {
  let marketplaces = useSkillMarketplaces(p.instanceId, {
    order: 'asc',
    status: ['active'],
    skillGroupId: p.skillGroupId,
    limit: publishedPageSize
  });
  let createPlugin = useCreateSkillPlugin();

  let openPublish = (publishedIds: string[]) =>
    showPublishToMarketplacePanel({
      instanceId: p.instanceId,
      skillGroupName: p.skillGroupName,
      excludeSkillMarketplaceIds: publishedIds,
      onSelect: async skillMarketplace => {
        let [plugin] = await createPlugin.mutate({
          instanceId: p.instanceId,
          skillMarketplaceId: skillMarketplace.id,
          skillGroupId: p.skillGroupId
        });
        if (!plugin) return false;

        skillMarketplacesLoader.refetchAll();
        return true;
      }
    });

  return renderWithPagination(marketplaces, { hidePaginationWhenUnavailable: true })(
    marketplaces => (
      <Box
        title="Published In"
        description="Marketplaces that list this group as a plugin. Skills added to or removed from the group sync to them automatically."
        rightActions={
          <Button
            size="2"
            variant="outline"
            iconLeft={<RiAddLine />}
            onClick={() => openPublish(marketplaces.data.items.map(item => item.id))}
          >
            Publish to Marketplace
          </Button>
        }
      >
        {marketplaces.data.items.length === 0 ? (
          <EmptyState>
            <Text color="gray600" size="2">
              This group is not published to any marketplace yet.
            </Text>
          </EmptyState>
        ) : (
          <Table
            headers={['Marketplace', 'Plugin', 'Sync']}
            data={marketplaces.data.items.map(marketplace => {
              let plugin = getGroupPlugin(marketplace, p.skillGroupId);
              let unsynced =
                plugin?.source.type === 'skill_group' ? plugin.source.unsyncedSkills : [];

              return {
                href: p.getSkillMarketplacePath?.(marketplace.id),
                data: [
                  <MarketplaceName>
                    <Avatar
                      entity={{ name: marketplace.name, imageUrl: marketplace.imageUrl }}
                      size={28}
                    />
                    <Text size="2" weight="strong">
                      {marketplace.name}
                    </Text>
                  </MarketplaceName>,
                  <Text size="2">{plugin?.name ?? '-'}</Text>,
                  unsynced.length ? (
                    <Badge color="orange" size="2">
                      {unsynced.length} not synced
                    </Badge>
                  ) : (
                    <Badge color="green" size="2">
                      In sync
                    </Badge>
                  )
                ]
              };
            })}
          />
        )}

        <createPlugin.RenderError />
        <Spacer size={10} />
      </Box>
    )
  );
};
