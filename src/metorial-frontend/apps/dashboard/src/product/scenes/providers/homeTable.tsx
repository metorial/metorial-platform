import type { DashboardInstanceProviderListingsListQuery } from '@metorial/dashboard-sdk';
import { createDataList, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useProviderListings } from '@metorial/state';
import { Avatar, Badge } from '@metorial/ui';
import { useInstanceContext } from '../../lib/dataList';

let HomeProvidersList = createDataList<{
  filters?: DashboardInstanceProviderListingsListQuery;
}>('home-providers')
  .context(useInstanceContext)
  .paginated(({ props, ctx, limit }) =>
    useProviderListings(ctx.instanceId, withDefaults(props.filters, { limit }))
  )
  .link((row, _props, ctx) =>
    row.provider?.slug
      ? Paths.instance.provider(ctx.organization, ctx.project, ctx.instance, row.provider.slug)
      : null
  )
  .item(row => ({
    title: row.name,
    icon: (
      <Avatar
        entity={{ name: row.name, photoUrl: row.imageUrl }}
        size={26}
        radius={6}
        imageFit="contain"
      />
    ),
    badges: row.categories.map(category => (
      <Badge key={category.id} size="1" color="gray">
        {category.name}
      </Badge>
    ))
  }))
  .layouts(['list'])
  .build();

export let HomeProvidersTable = (filter: DashboardInstanceProviderListingsListQuery) => (
  <HomeProvidersList
    filters={filter}
    listVariant="preview"
    listLayout="list"
    listLimit={filter.limit}
  />
);
