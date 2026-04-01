import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { Badge, Button, Spacer, Text, theme } from '@metorial/ui';
import { RiArrowRightUpLine, RiFlowChart, RiKey2Line, RiSparklingLine } from '@remixicon/react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { CatalogGrid, getCatalogItemDescription, getCatalogItemTitle } from '../../scenes/catalog/cards';
import { useProviderCatalog } from '../../state/consumer/catalog';
import { useConsumer } from '../../state/consumer/consumer';
import { useFeaturedContent } from '../../state/portal/client';
import { usePaths } from '../../state/portal/path';

let QuickGrid = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

let QuickCard = styled(Link)`
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid ${theme.colors.gray400};
  background: white;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: inherit;
  text-decoration: none;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.09);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

let SectionHeader = styled.div`
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
`;

let FeaturedGrid = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
`;

let FeaturedCard = styled(Link)`
  padding: 20px;
  border-radius: 20px;
  border: 1px solid ${theme.colors.gray400};
  background: white;
  color: inherit;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let EmptyPanel = styled.div`
  padding: 22px;
  border-radius: 18px;
  border: 1px dashed ${theme.colors.gray500};
  background: ${theme.colors.gray200};
`;

export let HomePage = () => {
  let Paths = usePaths();
  let consumer = useConsumer();
  let catalog = useProviderCatalog();
  let featuredContent = useFeaturedContent();

  return renderWithLoader({
    consumer,
    catalog,
    featuredContent
  })(({ consumer, catalog, featuredContent }) => {
    let featuredItems =
      featuredContent.data.items.length > 0
        ? featuredContent.data.items
        : catalog.data.items.slice(0, 3).map(item => ({
            id: item.id,
            type: item.type,
            name: getCatalogItemTitle(item),
            description: getCatalogItemDescription(item),
            availability: item.availability
          }));

    return (
      <ContentLayout>
        <Spacer height={28} />

        <PageHeader
          title={`Portal workspace for ${consumer.data.name}`}
          description="Browse approved providers, complete setup flows, and manage the Magic MCP entrypoints created from this portal."
        />

        <Spacer height={18} />

        <QuickGrid>
          <QuickCard to={Paths.catalog()}>
            <RiSparklingLine />
            <Text weight="bold">Provider catalog</Text>
            <Text size="2" color="gray700">
              Review everything this portal currently exposes to you.
            </Text>
          </QuickCard>

          <QuickCard to={Paths.magicMcpServers()}>
            <RiFlowChart />
            <Text weight="bold">Magic MCP deployments</Text>
            <Text size="2" color="gray700">
              Inspect the servers you created from provider templates.
            </Text>
          </QuickCard>

          <QuickCard to={Paths.magicMcpTokens()}>
            <RiKey2Line />
            <Text weight="bold">Magic MCP tokens</Text>
            <Text size="2" color="gray700">
              Create client secrets for connection flows and automations.
            </Text>
          </QuickCard>
        </QuickGrid>

        <Spacer height={30} />

        <SectionHeader>
          <div>
            <Text weight="bold">Featured in this portal</Text>
            <Text size="2" color="gray700">
              Highlighted items from the current consumer catalog and access context.
            </Text>
          </div>

          <Link to={Paths.catalog()}>
            <Button as="span" size="1" variant="ghost" color="gray">
              See all
              <RiArrowRightUpLine />
            </Button>
          </Link>
        </SectionHeader>

        <Spacer height={12} />

        {featuredItems.length > 0 ? (
          <FeaturedGrid>
            {featuredItems.map(item => (
              <FeaturedCard key={`${item.type}:${item.id}`} to={Paths.provider(item.id)}>
                <div>
                  <Badge color={item.availability == 'available_now' ? 'green' : 'orange'}>
                    {item.availability == 'available_now' ? 'Available now' : 'Request access'}
                  </Badge>
                </div>

                <Text weight="bold">{item.name || 'Untitled portal item'}</Text>
                <Text size="2" color="gray700">
                  {item.description || 'No description provided.'}
                </Text>
              </FeaturedCard>
            ))}
          </FeaturedGrid>
        ) : (
          <EmptyPanel>
            <Text weight="bold">Featured content is empty right now.</Text>
            <Text size="2" color="gray700">
              The full catalog below is still available, but this portal has not pinned any featured items.
            </Text>
          </EmptyPanel>
        )}

        <Spacer height={30} />

        <SectionHeader>
          <div>
            <Text weight="bold">Catalog preview</Text>
            <Text size="2" color="gray700">
              The first published items available from this portal.
            </Text>
          </div>
        </SectionHeader>

        <Spacer height={12} />

        <CatalogGrid
          items={catalog.data.items.slice(0, 6)}
          emptyTitle="No providers are published into this portal."
          emptyDescription="Once the backend portal catalog is populated, published templates and Magic MCP servers will appear here."
        />

        <Spacer height={36} />
      </ContentLayout>
    );
  });
};
