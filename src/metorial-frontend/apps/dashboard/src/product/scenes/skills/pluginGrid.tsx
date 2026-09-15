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


let Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

export let SkillPluginsGrid = (
  p: { instanceId: string; getPluginPath?: (pluginId: string) => string } & Omit<
    DashboardInstanceSkillsPluginsListQuery,
    'after' | 'before' | 'cursor' | 'limit'
  >
) => {
  let { instanceId, getPluginPath, ...query } = p;
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
  let getDefaultPluginPath = (pluginId: string) =>
    Paths.organization.settings(
      organization.data,
      'project',
      project.data?.slug,
      'instance',
      instance.data?.slug,
      'skills',
      'plugins',
      pluginId
    );
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
        navigate(getPluginPath?.(plugin.id) ?? getDefaultPluginPath(plugin.id));
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
              href={getPluginPath?.(plugin.id) ?? getDefaultPluginPath(plugin.id)}
              entity={{ id: plugin.id, hasUsage: true }}
              title={plugin.name}
              description={
                <Description>
                  {plugin.description || 'No description provided yet.'}
                </Description>
              }
              variant="v2"
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
                <Text size="1">{plugin.id}</Text>
              }
            />
          ))}
        </ItemGrid.Root>
      )}
    </>
  ));
};
