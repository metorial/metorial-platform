import type {
  DashboardInstanceCustomProvidersListOutput,
  DashboardInstanceCustomProvidersListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  f,
  lifecycleStatus,
  normalizeArrayFilterValue,
  withDefaults
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useCustomProviders } from '@metorial/state';
import { Text } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { CustomProviderImage } from './image';
import { getCustomProviderRemoteProtocolLabel } from './utils';

type CustomProvider = DashboardInstanceCustomProvidersListOutput['items'][number];

export type CustomProvidersFilters = Omit<
  DashboardInstanceCustomProvidersListQuery,
  'after' | 'before' | 'cursor'
>;

let typeLabels: Record<string, string> = {
  function: 'Function',
  container: 'Container',
  remote: 'Remote'
};

let getRepositoryLabel = (provider: CustomProvider) => {
  if (!provider.scmRepo?.url) return null;

  try {
    let url = new URL(provider.scmRepo.url);
    return url.pathname.replace(/^\/+/, '') || provider.scmRepo.url;
  } catch {
    return provider.scmRepo.url;
  }
};

let getProviderDetail = (provider: CustomProvider) => {
  if (provider.draft.remoteMcpServer?.url) {
    return {
      label: provider.draft.remoteMcpServer.url,
      secondary: getCustomProviderRemoteProtocolLabel(provider.draft.remoteMcpServer.transport)
    };
  }

  if (provider.draft.containerImage?.containerImage) {
    return {
      label: provider.draft.containerImage.containerImage,
      secondary: provider.draft.containerImage.containerRegistry
    };
  }

  let repositoryLabel = getRepositoryLabel(provider);
  if (repositoryLabel) {
    return { label: repositoryLabel, secondary: provider.scmRepo?.defaultBranch };
  }

  if (provider.provider?.slug) {
    return { label: provider.provider.slug, secondary: provider.provider.access };
  }

  return { label: undefined, secondary: undefined };
};

let getTitle = (provider: CustomProvider) =>
  provider.name || provider.provider?.name || 'Untitled';

let createCustomProvidersList = (opts: { name: string; hasTypeFilter: boolean }) =>
  createDataList<{ filters?: CustomProvidersFilters }>(opts.name)
    .context(useInstanceContext)
    .filters((_props, ctx) => {
      let { type, ...common } = {
        type: f.select('type', 'Type', [
          { id: 'function', label: 'Function' },
          { id: 'container', label: 'Container' }
        ]),
        status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
        providerId: f.entity(
          entityFilters.provider(ctx.instanceId, { label: 'Published Provider' })
        ),
        createdAt: f.createdAt(),
        updatedAt: f.updatedAt()
      };

      return (opts.hasTypeFilter ? { type, ...common } : common) as {
        type: typeof type;
      } & typeof common;
    })
    .search('Search providers…')
    .paginated(({ props, ctx, filters, search, limit }) =>
      useCustomProviders(
        ctx.instanceId,
        withDefaults(
          { order: 'desc' as const, ...props.filters },
          { ...filters, search: search ?? props.filters?.search, limit }
        )
      )
    )
    .columns([
      col.custom<CustomProvider>({
        id: 'name',
        header: 'Name',
        render: row => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CustomProviderImage
              providerId={row.provider?.id}
              name={getTitle(row)}
              size={26}
              radius={5}
            />

            <div>
              <Text size="2" weight="strong">
                {getTitle(row)}
              </Text>
              {(row.description ?? row.provider?.description) && (
                <Text size="1" color="gray600">
                  {row.description ?? row.provider?.description}
                </Text>
              )}
            </div>
          </div>
        )
      }),
      col.text<CustomProvider>({
        id: 'type',
        header: 'Type',
        get: row => typeLabels[row.type] ?? row.type
      }),
      col.status<CustomProvider, string>(lifecycleStatus),
      col.text<CustomProvider>({
        id: 'detail',
        header: 'Source',
        get: row => getProviderDetail(row).label
      }),
      col.createdAt(),
      col.updatedAt(),
      col.id()
    ])
    .link((row, _props, ctx) =>
      Paths.instance.customProvider(ctx.organization, ctx.project, ctx.instance, row.id)
    )
    .item(row => {
      let detail = getProviderDetail(row);

      return {
        title: getTitle(row),
        description: row.description ?? row.provider?.description,
        icon: (
          <CustomProviderImage
            providerId={row.provider?.id}
            name={getTitle(row)}
            size={30}
            radius={5}
          />
        ),
        footer: detail.label ? <Text size="1">{detail.label}</Text> : undefined,
        height: 230
      };
    })
    .layouts(['grid', 'table'], { default: 'grid' })
    .build();

let ManagedCustomProvidersList = createCustomProvidersList({
  name: 'custom-providers',
  hasTypeFilter: true
});

let ExternalCustomProvidersList = createCustomProvidersList({
  name: 'external-providers',
  hasTypeFilter: false
});

export let CustomProvidersGrid = ({
  withSearch: _withSearch,
  ...filters
}: CustomProvidersFilters & { withSearch?: boolean }) => {
  let types = normalizeArrayFilterValue(filters.type);
  let List =
    types?.length === 1 && types[0] === 'remote'
      ? ExternalCustomProvidersList
      : ManagedCustomProvidersList;

  return <List filters={filters} />;
};
