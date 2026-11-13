import type { DashboardInstanceIntegrationsListQuery } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  lifecycleStatus,
  withDefaults,
  type DataListEnrichResult
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import {
  useAllProviderListings,
  useIntegrations,
  type IntegrationPreview
} from '@metorial/state';
import { Avatar, Text } from '@metorial/ui';
import { useMemo } from 'react';
import { useInstanceContext } from '../../lib/dataList';
import {
  ProviderAvatarStack,
  type ProviderAvatarStackEntry
} from '../../lib/providerAvatarStack';
import { integrationFilterDefs } from './filters';
import { buildProviderListingLookup, getProviderLabel } from './providerLabels';

export type IntegrationsFilters = Omit<
  DashboardInstanceIntegrationsListQuery,
  'after' | 'before' | 'cursor'
>;

type IntegrationRow = IntegrationPreview & { providerStack: ProviderAvatarStackEntry[] };

let useIntegrationProviderStacks = (
  items: IntegrationPreview[],
  { ctx }: { ctx: { instanceId?: string } }
): DataListEnrichResult<IntegrationRow> => {
  let providerIds = useMemo(
    () =>
      [
        ...new Set(
          items.flatMap(integration =>
            (integration.providers ?? []).map(provider => provider.provider.id)
          )
        )
      ].sort(),
    [items]
  );

  let listings = useAllProviderListings(ctx.instanceId, providerIds);

  let enriched = useMemo(() => {
    let lookup = buildProviderListingLookup(listings.data ?? undefined);

    return items.map(integration => ({
      ...integration,
      providerStack: (integration.providers ?? []).map(provider => ({
        id: provider.id ?? provider.provider.id,
        name: lookup[provider.provider.id]?.name ?? getProviderLabel(provider),
        imageUrl: lookup[provider.provider.id]?.imageUrl
      }))
    }));
  }, [items, listings.data]);

  return { items: enriched, isLoading: listings.isLoading, error: listings.error };
};

export let IntegrationsGrid = createDataList<{
  instanceId?: string;
  filters?: IntegrationsFilters;
}>('integrations')
  .context(useInstanceContext)
  .filters((props, ctx) => integrationFilterDefs(props.instanceId ?? ctx.instanceId))
  .search('Search integrations…')
  .paginated(({ props, ctx, filters, search, limit }) =>
    useIntegrations(
      props.instanceId ?? ctx.instanceId,
      withDefaults(
        { order: 'desc' as const, status: ['active' as const], ...props.filters },
        {
          ...filters,
          search: search ?? props.filters?.search,
          limit
        }
      )
    )
  )
  .enrich(useIntegrationProviderStacks)
  .columns([
    col.name(),
    col.custom<IntegrationRow>({
      id: 'providers',
      header: 'Providers',
      render: row => <ProviderAvatarStack providers={row.providerStack} size={24} />
    }),
    col.status(lifecycleStatus),
    col.text({ id: 'slug', header: 'Slug', isDefault: false, get: row => row.slug }),
    col.createdAt(),
    col.updatedAt(),
    col.id()
  ])
  .link((row, _props, ctx) =>
    Paths.instance.integration(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .item(row => ({
    title: row.name,
    description: row.description,
    icon:
      row.providerStack.length > 0 ? (
        <ProviderAvatarStack providers={row.providerStack} />
      ) : (
        <Avatar entity={row} size={30} />
      ),
    footer: row.slug ? <Text size="1">{row.slug}</Text> : undefined,
    height: 220
  }))
  .layouts(['grid', 'table'], { default: 'grid' })
  .build();
