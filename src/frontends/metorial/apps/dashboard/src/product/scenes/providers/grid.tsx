import type {
  DashboardInstanceProviderListingsListOutput,
  DashboardInstanceProviderListingsListQuery
} from '@metorial/dashboard-sdk';
import { createDataList, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useProviderListings } from '@metorial/state';
import { Avatar, Badge, Text } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import { useInstanceContext } from '../../lib/dataList';
import { providerListingFilterDefs } from './filters';

export type ProviderListing = DashboardInstanceProviderListingsListOutput['items'][number];

export type ProviderListingsFilters = Omit<
  DashboardInstanceProviderListingsListQuery,
  'after' | 'before' | 'cursor'
>;

export let providerListingBadges = (listing: ProviderListing) => (
  <>
    {listing.attributes.isVerified && (
      <Badge size="1" color="blue" icon={<RiCheckLine />}>
        Verified
      </Badge>
    )}

    {listing.attributes.isOfficial && (
      <Badge size="1" color="gray">
        Official
      </Badge>
    )}
  </>
);

let truncate = (value: string | null | undefined, length: number) =>
  value ? value.slice(0, length) + (value.length > length ? '...' : '') : '';

export let ProvidersGrid = createDataList<{ filters?: ProviderListingsFilters }>('providers')
  .context(useInstanceContext)
  .filters((_props, ctx) => providerListingFilterDefs(ctx.instanceId))
  .search('Search providers…')
  .paginated(({ props, ctx, filters, search, limit }) =>
    useProviderListings(
      ctx.instanceId,
      withDefaults(
        { limit: 21, ...props.filters },
        {
          providerCategoryId: filters.providerCategoryId,
          isVerified: filters.isVerified ? true : undefined,
          search: search ?? props.filters?.search,
          limit
        }
      )
    )
  )
  .link((row, _props, ctx) =>
    row.provider?.slug
      ? Paths.instance.provider(ctx.organization, ctx.project, ctx.instance, row.provider.slug)
      : null
  )
  .item(row => ({
    title: row.name,
    description: truncate(row.description, 100),
    listDescription: false,
    icon: (
      <Avatar
        entity={{ name: row.name, photoUrl: row.imageUrl }}
        size={30}
        radius={5}
        imageFit="contain"
      />
    ),
    badges: providerListingBadges(row),
    meta: row.provider?.slug,
    footer: row.provider?.slug ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text size="2">{row.provider.slug}</Text>
        {providerListingBadges(row)}
      </div>
    ) : undefined,
    height: 250
  }))
  .layouts(['list', 'grid'], { default: 'grid' })
  .build();
