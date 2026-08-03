import type { DashboardInstanceSkillsMarketplacesListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillMarketplaces
} from '@metorial/state';
import { Avatar, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { EmptyState } from '@metorial/empty-state';
import { showSkillMarketplaceFormModal } from './marketplaceModal';

let Count = styled.div`
  background: ${theme.colors.gray300};
  min-height: 26px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
`;

let Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

export let SkillMarketplacesGrid = (
  p: { instanceId: string } & Omit<
    DashboardInstanceSkillsMarketplacesListQuery,
    'after' | 'before' | 'cursor' | 'limit'
  >
) => {
  let { instanceId, ...query } = p;
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let marketplaces = useSkillMarketplaces(instanceId, {
    order: 'desc',
    status: ['active'],
    limit: 21,
    ...query
  });
  let hasActiveFilters = !!(
    query.search ||
    query.createdAt ||
    query.updatedAt ||
    (Array.isArray(query.status) ? query.status.length > 0 : query.status)
  );

  let showCreateModal = () => {
    if (!instance.data) return;

    showSkillMarketplaceFormModal({
      instanceId: instance.data.id,
      onCreate: marketplace => {
        navigate(
          Paths.instance.skillMarketplace(
            organization.data,
            project.data,
            instance.data,
            marketplace.id
          )
        );
      }
    });
  };

  return renderWithPagination(marketplaces, {
    emptyState: (
      <>
        {query.search && (
          <Text size="2" color="gray600">
            No marketplaces found.
          </Text>
        )}

        {!hasActiveFilters && (
          <EmptyState
            extra="Skill Marketplaces"
            title="Create your first marketplace"
            description="Marketplaces let you publish selected plugins and skills to your users."
            action={{
              label: 'Create Marketplace',
              onClick: showCreateModal
            }}
          />
        )}

        {!query.search && hasActiveFilters && (
          <Text size="2" color="gray600">
            No marketplaces match the current filters.
          </Text>
        )}
      </>
    )
  })(marketplaces => (
    <>
      {marketplaces.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {marketplaces.data.items.map(marketplace => (
            <ItemGrid.Item
              key={marketplace.id}
              href={Paths.instance.skillMarketplace(
                organization.data,
                project.data,
                instance.data,
                marketplace.id
              )}
              entity={{ id: marketplace.id, hasUsage: true }}
              title={marketplace.name}
              description={
                <Description>
                  {marketplace.description || 'No description provided yet.'}
                </Description>
              }
              height={200}
              icon={
                <Avatar
                  entity={{
                    name: marketplace.name,
                    photoUrl: marketplace.imageUrl ?? undefined,
                    imageUrl: `https://avatar-cdn.metorial.com/${marketplace.id}`
                  }}
                  size={30}
                  imageFit="contain"
                />
              }
              bottom={
                <div style={{ display: 'flex' }}>
                  <Count>
                    {marketplace.plugins.length} plugin
                    {marketplace.plugins.length === 1 ? '' : 's'}
                  </Count>
                </div>
              }
            />
          ))}
        </ItemGrid.Root>
      )}
    </>
  ));
};
