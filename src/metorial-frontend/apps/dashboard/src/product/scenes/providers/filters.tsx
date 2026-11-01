import type {
  DashboardInstanceProviderListingsListOutput,
  DashboardInstanceProviderListingsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  providerCategoriesLoader,
  providerListingsLoader,
  useCurrentInstance
} from '@metorial/state';
import { Avatar } from '@metorial/ui';
import React, { type Dispatch, type SetStateAction, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilterToolbar,
  type FilterSuggestionGroup,
  TableFilter,
  TableFilterState,
  getFilterPayload,
  getEnumListFilterValue,
  getListFilterValue
} from '@metorial/table';
import { useDebounced } from '@metorial/use-debounced';
import { defineEntityFilter, useEntityList } from '../entityFilters';

type ProviderListing = DashboardInstanceProviderListingsListOutput['items'][number];

let providerCategoryFilter = (instanceId: string | undefined) =>
  defineEntityFilter({
    id: 'providerCategoryId',
    label: 'Category',
    noun: 'categories',
    mode: 'recent',
    useList: q => {
      let categories = useEntityList(
        providerCategoriesLoader.use(instanceId && q ? { instanceId } : null),
        category => ({ id: category.id, label: category.name, slug: category.slug })
      );
      let idsKey = q?.ids?.join(',');

      return useMemo(() => {
        let ids = idsKey ? new Set(idsKey.split(',')) : undefined;
        let items = categories.items
          .filter(category => !ids || ids.has(category.id))
          .sort((a, b) => a.label.localeCompare(b.label));

        return { items, isLoading: categories.isLoading };
      }, [categories, idsKey]);
    }
  })({ highlight: { label: 'Categories' } });

export let useProviderListingFilters = (p: {
  search: string;
  filterState: TableFilterState[];
}) => {
  let trueFilterValues = useMemo(() => ['true'] as const, []);
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;
  let searchDebounced = useDebounced(p.search, 500);

  let filters: TableFilter<any>[] = useMemo(
    () => [
      providerCategoryFilter(instanceId),
      {
        id: 'isVerified',
        fields: ['isVerified'],
        label: 'Verified',
        description: 'Filter by verified status',
        type: 'select',
        options: [{ id: 'true', label: 'Verified only' }]
      }
    ],
    [instanceId]
  );

  let filterPayload = useMemo(() => getFilterPayload(p.filterState), [p.filterState]);
  let providerCategoryId = getListFilterValue(
    filterPayload.providerCategoryId
  ) as DashboardInstanceProviderListingsListQuery['providerCategoryId'];
  let isVerified = !!getEnumListFilterValue(filterPayload.isVerified, trueFilterValues)
    ? true
    : undefined;

  let providerListingsFilter = useMemo(
    (): DashboardInstanceProviderListingsListQuery => ({
      ...(searchDebounced.trim() ? { search: searchDebounced.trim() } : {}),
      ...(providerCategoryId ? { providerCategoryId } : {}),
      ...(isVerified ? { isVerified } : {})
    }),
    [searchDebounced, providerCategoryId, isVerified]
  );

  return {
    filters,
    searchDebounced,
    providerListingsFilter
  };
};

let useProviderSuggestions = (
  instanceId: string | undefined,
  search: string,
  onSelect: (listing: ProviderListing) => void
): FilterSuggestionGroup[] => {
  let query = useDebounced(search.trim(), 250);
  let listings = providerListingsLoader.use(
    instanceId && query ? { instanceId, search: query, limit: 5 } : null
  );

  if (!query) return [];

  return [
    {
      id: 'providers',
      label: 'Providers',
      isLoading: listings.isLoading,
      items: (listings.data?.items ?? []).map(listing => ({
        id: listing.id,
        label: listing.name,
        description: listing.categories?.[0]?.name,
        icon: (
          <Avatar
            entity={{ name: listing.name, photoUrl: listing.imageUrl }}
            size={22}
            radius={5}
            imageFit="contain"
          />
        ),
        onSelect: () => onSelect(listing)
      }))
    }
  ];
};

export let ProviderListingFilters = (p: {
  searchState: [string, Dispatch<SetStateAction<string>>];
  filterState: [TableFilterState[], Dispatch<SetStateAction<TableFilterState[]>>];
  filters: TableFilter<any>[];
  onProviderSelect?: (listing: ProviderListing) => void;
  end?: React.ReactNode;
}) => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let suggestions = useProviderSuggestions(instance.data?.id, p.searchState[0], listing => {
    if (p.onProviderSelect) return p.onProviderSelect(listing);
    if (!listing.provider?.slug) return;

    navigate(
      Paths.instance.provider(
        instance.data?.organization,
        instance.data?.project,
        instance.data,
        listing.provider.slug
      )
    );
  });

  return (
    <FilterToolbar
      searchState={p.searchState}
      filterState={p.filterState}
      filters={p.filters}
      placeholder="Search providers or filter..."
      suggestions={suggestions}
      end={p.end}
    />
  );
};
