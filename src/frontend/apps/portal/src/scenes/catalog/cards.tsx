import { Avatar, Badge, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import type { ProviderCatalogItem, ProviderCatalogList } from '../../state/consumer/catalog';
import { usePaths } from '../../state/portal/path';

let EmptyState = styled.div`
  padding: 22px;
  border-radius: 8px;
  background: ${theme.colors.gray200};
`;

export let getCatalogItemTitle = (
  item: ProviderCatalogItem | ProviderCatalogList['items'][number]
) => {
  return item.type == 'provider_template'
    ? item.providerTemplate.name
    : item.magicMcpServer.name || 'Untitled Magic MCP server';
};

export let getCatalogItemDescription = (
  item: ProviderCatalogItem | ProviderCatalogList['items'][number]
) => {
  return item.type == 'provider_template'
    ? item.providerTemplate.description ||
        item.provider.description ||
        'No description provided.'
    : item.magicMcpServer.description;
};

let getCatalogItemTypeLabel = (
  item: ProviderCatalogItem | ProviderCatalogList['items'][number]
) => {
  return item.type == 'provider_template' ? 'Provider template' : 'Magic MCP';
};

export let CatalogGrid = ({
  items,
  emptyTitle = 'No portal providers are available yet.',
  emptyDescription = 'Try another search term or check back once new providers are published.'
}: {
  items: ProviderCatalogList['items'];
  emptyTitle?: string;
  emptyDescription?: string;
}) => {
  let Paths = usePaths();
  let navigate = useNavigate();

  if (items.length == 0) {
    return (
      <EmptyState>
        <Text weight="bold">{emptyTitle}</Text>
        <Text size="2" color="gray700">
          {emptyDescription}
        </Text>
      </EmptyState>
    );
  }

  return (
    <ItemGrid.Root width="280px">
      {items.map(item => {
        let title = getCatalogItemTitle(item);
        let description = getCatalogItemDescription(item);

        return (
          <ItemGrid.Item
            key={item.id}
            entity={{ id: item.id }}
            title={title}
            description={description}
            icon={
              item.type == 'provider_template' ? (
                <Avatar
                  entity={{
                    name: title,
                    imageUrl: `https://avatar-cdn.metorial.com/${item.provider.id}`
                  }}
                  size={36}
                />
              ) : (
                <Avatar
                  entity={{
                    name: title,
                    imageUrl: `https://avatar-cdn.metorial.com/${item.magicMcpServer.id}`
                  }}
                  size={36}
                />
              )
            }
            onClick={() => navigate(Paths.provider(item.id))}
            bottom={
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Badge color={item.availability == 'available_now' ? 'green' : 'orange'}>
                    {item.availability == 'available_now' ? 'Available now' : 'Request access'}
                  </Badge>
                  <Badge color="gray">{getCatalogItemTypeLabel(item)}</Badge>
                </div>
              </>
            }
          />
        );
      })}
    </ItemGrid.Root>
  );
};
