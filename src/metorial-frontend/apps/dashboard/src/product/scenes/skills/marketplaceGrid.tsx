import type {
  DashboardInstanceSkillsMarketplacesListOutput,
  DashboardInstanceSkillsMarketplacesListQuery
} from '@metorial/dashboard-sdk';
import { col, createDataList, f, lifecycleStatus, withDefaults } from '@metorial/data-list';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { useSkillMarketplaces } from '@metorial/state';
import { Avatar, Text } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';
import { showSkillMarketplaceFormModal } from './marketplaceModal';

type Marketplace = DashboardInstanceSkillsMarketplacesListOutput['items'][number];

export type SkillMarketplaceFilters = Omit<
  DashboardInstanceSkillsMarketplacesListQuery,
  'after' | 'before' | 'cursor' | 'limit'
>;

let Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

let getActivePlugins = (marketplace: Marketplace) =>
  marketplace.plugins.filter(plugin => plugin.status === 'active');

let getActiveSkillCount = (marketplace: Marketplace) =>
  getActivePlugins(marketplace)
    .flatMap(plugin => plugin.skillPlugin?.skills ?? [])
    .filter(skill => skill.status === 'active').length;

export let SkillMarketplacesEmptyState = (p: {
  getHref?: (marketplaceId: string) => string;
}) => {
  let ctx = useInstanceContext();
  let navigate = useNavigate();

  return (
    <EmptyState
      extra="Skill Marketplaces"
      title="Create your first marketplace"
      description="Marketplaces let you publish selected plugins and skills for your team."
      action={{
        label: 'Create Marketplace',
        onClick: () => {
          if (!ctx.instanceId) return;

          showSkillMarketplaceFormModal({
            instanceId: ctx.instanceId,
            onCreate: marketplace =>
              navigate(
                p.getHref?.(marketplace.id) ??
                  Paths.instance.skillMarketplace(
                    ctx.organization,
                    ctx.project,
                    ctx.instance,
                    marketplace.id
                  )
              )
          });
        }
      }}
    />
  );
};

export let SkillMarketplacesList = createDataList<{
  instanceId?: string;
  getHref?: (marketplaceId: string) => string;
  filters?: SkillMarketplaceFilters;
}>('skill-marketplaces')
  .context(useInstanceContext)
  .filters(() => ({
    status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search marketplaces…')
  .paginated(({ props, ctx, filters, search }) =>
    useSkillMarketplaces(
      props.instanceId ?? ctx.instanceId,
      withDefaults(
        { order: 'desc' as const, status: ['active' as const], limit: 21, ...props.filters },
        { ...filters, search: search ?? props.filters?.search }
      )
    )
  )
  .columns([
    col.name<Marketplace>(),
    col.count<Marketplace>('plugins', row => getActivePlugins(row).length, 'plugin', {
      header: 'Plugins'
    }),
    col.count<Marketplace>('skills', getActiveSkillCount, 'skill', {
      header: 'Skills',
      isDefault: false
    }),
    col.createdAt<Marketplace>(),
    col.id<Marketplace>({ isDefault: true }),
    col.status<Marketplace, any>(lifecycleStatus, { isDefault: false }),
    col.updatedAt<Marketplace>()
  ])
  .link((row, props, ctx) =>
    props.getHref
      ? props.getHref(row.id)
      : Paths.instance.skillMarketplace(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .item(marketplace => ({
    title: marketplace.name,
    description: <Description>{marketplace.description}</Description>,
    icon: (
      <Avatar
        entity={{
          name: marketplace.name,
          photoUrl: marketplace.imageUrl ?? undefined,
          imageUrl: `https://avatar-cdn.metorial.com/${marketplace.id}`
        }}
        size={30}
        imageFit="contain"
      />
    ),
    footer: <Text size="1">{marketplace.id}</Text>,
    height: 200
  }))
  .layouts(['grid', 'table'], { default: 'grid' })
  .build();

export let SkillMarketplacesGrid = (
  p: {
    instanceId: string;
    getHref?: (marketplaceId: string) => string;
    hideCreate?: boolean;
    layout?: 'table' | 'grid';
  } & SkillMarketplaceFilters
) => {
  let { instanceId, getHref, hideCreate, layout, ...filters } = p;

  return (
    <SkillMarketplacesList
      instanceId={instanceId}
      getHref={getHref}
      filters={filters}
      listLayout={layout}
      hideToolbar={layout != 'table'}
      emptyState={{
        initial: hideCreate
          ? 'No skill marketplaces yet.'
          : () => <SkillMarketplacesEmptyState getHref={getHref} />,
        filtered: 'No marketplaces match the current filters.'
      }}
    />
  );
};
