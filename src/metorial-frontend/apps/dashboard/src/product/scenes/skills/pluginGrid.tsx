import type { DashboardInstanceSkillsPluginsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillPlugins
} from '@metorial/state';
import { Avatar, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { EmptyState } from '@metorial/empty-state';
import { showSkillPluginFormModal } from './pluginModal';

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

export let SkillPluginsGrid = (
  p: { instanceId: string } & Omit<
    DashboardInstanceSkillsPluginsListQuery,
    'after' | 'before' | 'cursor' | 'limit'
  >
) => {
  let { instanceId, ...query } = p;
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let plugins = useSkillPlugins(instanceId, {
    order: 'desc',
    status: ['active'],
    limit: 21,
    ...query
  });
  let hasActiveFilters = !!(
    query.search ||
    query.category ||
    query.skillMarketplaceId ||
    query.createdAt ||
    query.updatedAt ||
    (Array.isArray(query.status) ? query.status.length > 0 : query.status)
  );

  let showCreateModal = () => {
    if (!instance.data) return;

    showSkillPluginFormModal({
      instanceId: instance.data.id,
      onCreate: plugin => {
        navigate(
          Paths.instance.skillPlugin(organization.data, project.data, instance.data, plugin.id)
        );
      }
    });
  };

  return renderWithPagination(plugins, {
    emptyState: (
      <>
        {query.search && (
          <Text size="2" color="gray600">
            No plugins found.
          </Text>
        )}

        {!hasActiveFilters && (
          <EmptyState
            extra="Skill Plugins"
            title="Create your first plugin"
            description="Bundle skills to use them in agent clients or publish them in a marketplace."
            action={{
              label: 'Create Plugin',
              onClick: showCreateModal
            }}
          />
        )}

        {!query.search && hasActiveFilters && (
          <Text size="2" color="gray600">
            No plugins match the current filters.
          </Text>
        )}
      </>
    )
  })(plugins => (
    <>
      {plugins.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {plugins.data.items.map(plugin => (
            <ItemGrid.Item
              key={plugin.id}
              href={Paths.instance.skillPlugin(
                organization.data,
                project.data,
                instance.data,
                plugin.id
              )}
              entity={{ id: plugin.id, hasUsage: true }}
              title={plugin.name}
              description={
                <Description>
                  {plugin.description || 'No description provided yet.'}
                </Description>
              }
              height={200}
              icon={
                <Avatar
                  entity={{
                    name: plugin.name,
                    photoUrl: plugin.imageUrl ?? undefined,
                    imageUrl: `https://avatar-cdn.metorial.com/${plugin.id}`
                  }}
                  size={30}
                  imageFit="contain"
                />
              }
              bottom={
                <div style={{ display: 'flex' }}>
                  <Count>
                    {plugin.skills.length} skill{plugin.skills.length === 1 ? '' : 's'}
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
