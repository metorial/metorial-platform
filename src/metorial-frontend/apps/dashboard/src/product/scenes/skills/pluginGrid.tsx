import type {
  DashboardInstanceSkillsPluginsListOutput,
  DashboardInstanceSkillsPluginsListQuery
} from '@metorial/dashboard-sdk';
import { col, createDataList, f, lifecycleStatus, withDefaults } from '@metorial/data-list';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { useSkillPlugins } from '@metorial/state';
import { Avatar, Text } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { useInstanceContext, type InstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { showSkillPluginFormModal } from './pluginModal';

type SkillPlugin = DashboardInstanceSkillsPluginsListOutput['items'][number];

export type SkillPluginFilters = Omit<
  DashboardInstanceSkillsPluginsListQuery,
  'after' | 'before' | 'cursor' | 'limit'
>;

let Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

let getDefaultPluginPath = (ctx: InstanceContext, pluginId: string) =>
  Paths.organization.settings(
    ctx.organization,
    'project',
    ctx.project?.slug,
    'instance',
    ctx.instance?.slug,
    'skills',
    'plugins',
    pluginId
  );

export let SkillPluginsEmptyState = (p: { getPluginPath?: (pluginId: string) => string }) => {
  let ctx = useInstanceContext();
  let navigate = useNavigate();

  return (
    <EmptyState
      extra="Skill Plugins"
      title="Create your first plugin"
      description="Bundle skills to use them in agent clients or publish them in a marketplace."
      action={{
        label: 'Create Plugin',
        onClick: () => {
          if (!ctx.instanceId) return;

          showSkillPluginFormModal({
            instanceId: ctx.instanceId,
            onCreate: plugin =>
              navigate(p.getPluginPath?.(plugin.id) ?? getDefaultPluginPath(ctx, plugin.id))
          });
        }
      }}
    />
  );
};

export let SkillPluginsList = createDataList<{
  instanceId?: string;
  getPluginPath?: (pluginId: string) => string;
  filters?: SkillPluginFilters;
}>('skill-plugins')
  .context(useInstanceContext)
  .filters((props, ctx) => ({
    status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
    category: f.string('category', 'Category'),
    skillMarketplaceId: f.entity(
      entityFilters.skillMarketplace(props.instanceId ?? ctx.instanceId)
    ),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search plugins…')
  .paginated(({ props, ctx, filters, search }) =>
    useSkillPlugins(
      props.instanceId ?? ctx.instanceId,
      withDefaults(
        { order: 'desc' as const, status: ['active' as const], limit: 21, ...props.filters },
        { ...filters, search: search ?? props.filters?.search }
      )
    )
  )
  .columns([
    col.name<SkillPlugin>(),
    col.text<SkillPlugin>({ id: 'category', header: 'Category', get: row => row.category }),
    col.createdAt<SkillPlugin>(),
    col.id<SkillPlugin>({ isDefault: true }),
    col.status<SkillPlugin, any>(lifecycleStatus, { isDefault: false }),
    col.updatedAt<SkillPlugin>()
  ])
  .link(
    (row, props, ctx) => props.getPluginPath?.(row.id) ?? getDefaultPluginPath(ctx, row.id)
  )
  .item(plugin => ({
    title: plugin.name,
    description: (
      <Description>{plugin.description || 'No description provided yet.'}</Description>
    ),
    icon: (
      <Avatar
        entity={{
          name: plugin.name,
          photoUrl: plugin.imageUrl ?? undefined,
          imageUrl: `https://avatar-cdn.metorial.com/${plugin.id}`
        }}
        size={30}
        imageFit="contain"
      />
    ),
    footer: <Text size="1">{plugin.id}</Text>,
    height: 200
  }))
  .layouts(['grid', 'table'], { default: 'grid' })
  .build();

export let SkillPluginsGrid = (
  p: { instanceId: string; getPluginPath?: (pluginId: string) => string } & SkillPluginFilters
) => {
  let { instanceId, getPluginPath, ...filters } = p;

  return (
    <SkillPluginsList
      instanceId={instanceId}
      getPluginPath={getPluginPath}
      filters={filters}
      hideToolbar
      emptyState={{
        initial: () => <SkillPluginsEmptyState getPluginPath={getPluginPath} />,
        filtered: 'No plugins match the current filters.'
      }}
    />
  );
};
