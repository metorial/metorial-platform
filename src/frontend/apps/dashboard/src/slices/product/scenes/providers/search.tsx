import type {
  DashboardInstanceProviderListingsListQuery,
  ProviderListingsGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderDeployments,
  useProviderListings
} from '@metorial/state';
import {
  Avatar,
  Badge,
  ButtonSize,
  CenteredSpinner,
  getButtonSize,
  Input,
  InputLabel,
  Popover,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { RiCheckLine } from '@remixicon/react';
import { useMemo, useState } from 'react';
import { useMeasure } from 'react-use';
import styled from 'styled-components';
import { useDebounced } from '../../../../hooks/useDebounced';
import { getProviderOAuthAutoRegistrationEnabled } from '../../lib/providerOAuthAutoRegistration';

export type ProviderSearchItem = {
  id: string;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  oauthAutoRegistrationEnabled?: boolean;
  attributes?: {
    isVerified?: boolean;
    isMetorial?: boolean;
    isOfficial?: boolean;
  };
  categories?: { id: string; name: string }[];
};

type ProviderSearchVariant = 'compactList' | 'providerCard';
type ProviderCardSize = 'default' | 'compact';

// height: ${
//   typeof $internalScrollHeight === 'number'
//     ? `${$internalScrollHeight}px`
//     : ($internalScrollHeight ?? '100%')
// };
// max-height: ${
//   typeof $internalScrollHeight === 'number'
//     ? `${$internalScrollHeight}px`
//     : ($internalScrollHeight ?? '100%')
// };

let Wrapper = styled.div<{
  $internalScroll?: boolean;
  $internalScrollHeight?: string | number;
}>`
  ${({ $internalScroll, $internalScrollHeight }) =>
    $internalScroll
      ? `

    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  `
      : ''}
`;

let ScrollBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  /* scrollbar-gutter: stable; */
`;

let Grid = styled.div<{ $columns?: number }>`
  display: grid;
  grid-template-columns: ${({ $columns }) =>
    $columns
      ? `repeat(${$columns}, minmax(0, 1fr))`
      : 'repeat(auto-fill, minmax(150px, 1fr))'};
  gap: 10px;

  @media (max-width: 700px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 520px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let GridButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  background: none;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  text-align: left;
  transition:
    border-color 0.15s,
    background 0.15s;
  min-width: 0;
  overflow: hidden;

  &:hover {
    border-color: ${theme.colors.gray500};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.72;
  }
`;

let ProviderName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray800};
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let CardCategories = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

let ProviderCardWrapper = styled.div`
  position: relative;

  &[data-disabled='true'] {
    opacity: 0.72;
  }

  &[data-creating='true'] [data-button='true'] {
    opacity: 0.72;
  }

  [data-button='true'] {
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease;

    &:hover,
    &:focus {
      border-color: ${theme.colors.gray400};
      box-shadow: ${theme.shadows.small};
    }
  }

  &[data-selected='true'] [data-button='true'] {
    border-color: ${theme.colors.black900};
    box-shadow: ${theme.shadows.small};
  }

  &[data-selected='true'] [data-button='true']:hover,
  &[data-selected='true'] [data-button='true']:focus {
    border-color: ${theme.colors.black900};
  }
`;

let CreatingCardSpinner = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`;

let CardCategory = styled.div`
  background: #f0f0f0;
  height: 26px;
  border-radius: 50px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
`;

let FieldWrapper = styled.div`
  display: flex;
  outline: 1px solid transparent;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};
  outline: none;
  width: 100%;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
  border: none;
  font-weight: 500;
  flex-shrink: 0;

  &:focus-within,
  &:focus {
    background: ${theme.colors.gray300};
    outline: 1px solid ${theme.colors.gray600};
  }
`;

let ProviderItemsGrid = ({
  items,
  onSelect,
  emptyText = 'No providers found',
  columns,
  selectionMode = 'default',
  variant = 'compactList',
  cardSize = 'default',
  selectedProviderId,
  creatingProviderId,
  selectionDisabled
}: {
  items: ProviderSearchItem[];
  onSelect?: (provider: ProviderSearchItem) => void;
  emptyText?: string;
  columns?: number;
  selectionMode?: 'default' | 'authCredentialsCreate';
  variant?: ProviderSearchVariant;
  cardSize?: ProviderCardSize;
  selectedProviderId?: string;
  creatingProviderId?: string;
  selectionDisabled?: boolean;
}) => {
  if (items.length === 0) {
    return (
      <Text size="1" color="gray600">
        {emptyText}
      </Text>
    );
  }

  if (variant === 'providerCard') {
    return (
      <ItemGrid.Root width={cardSize === 'compact' ? '270px' : '300px'}>
        {items.map(provider => {
          let isCreating = creatingProviderId === provider.id;
          let isUnavailable =
            selectionMode === 'authCredentialsCreate' && provider.oauthAutoRegistrationEnabled;
          let isDisabled = isUnavailable || (!!selectionDisabled && !isCreating);
          let clickDisabled = isDisabled || !!selectionDisabled;
          let disabledReason = isUnavailable
            ? 'This provider uses OAuth auto-registration, so manual app credentials are not supported.'
            : isDisabled
              ? 'A callback is already being created.'
              : undefined;
          let description = provider.description
            ? provider.description.slice(0, cardSize === 'compact' ? 80 : 100) +
              (provider.description.length > (cardSize === 'compact' ? 80 : 100) ? '...' : '')
            : '';

          return (
            <ProviderCardWrapper
              key={provider.id}
              title={disabledReason}
              data-disabled={isDisabled ? 'true' : 'false'}
              data-creating={isCreating ? 'true' : 'false'}
              data-selected={selectedProviderId === provider.id ? 'true' : 'false'}
            >
              {isCreating && (
                <CreatingCardSpinner>
                  <CenteredSpinner />
                </CreatingCardSpinner>
              )}

              <ItemGrid.Item
                title={provider.name ?? provider.slug ?? 'Provider'}
                description={description}
                height={cardSize === 'compact' ? 220 : 250}
                onClick={clickDisabled ? undefined : () => onSelect?.(provider)}
                icon={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar
                      entity={{
                        name: provider.name ?? provider.slug ?? 'Provider',
                        photoUrl: provider.imageUrl ?? undefined
                      }}
                      size={30}
                      radius={5}
                      imageFit="contain"
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {provider.attributes?.isVerified && (
                        <Badge size="1" color="blue">
                          <RiCheckLine size={12} style={{ marginRight: 3 }} /> Verified
                        </Badge>
                      )}

                      {(provider.attributes?.isMetorial ||
                        provider.attributes?.isOfficial) && (
                        <Badge size="1" color="gray">
                          Official
                        </Badge>
                      )}
                    </div>
                  </div>
                }
                bottom={
                  <CardCategories>
                    {(provider.categories ?? [])
                      .slice(0, cardSize === 'compact' ? 2 : 3)
                      .map(category => (
                        <CardCategory key={category.id}>{category.name}</CardCategory>
                      ))}
                  </CardCategories>
                }
              />
            </ProviderCardWrapper>
          );
        })}
      </ItemGrid.Root>
    );
  }

  return (
    <Grid $columns={columns}>
      {items.map(provider => {
        let isCreating = creatingProviderId === provider.id;
        let isUnavailable =
          selectionMode === 'authCredentialsCreate' && provider.oauthAutoRegistrationEnabled;
        let isDisabled = isUnavailable || (!!selectionDisabled && !isCreating);
        let clickDisabled = isDisabled || !!selectionDisabled;
        let disabledReason = isUnavailable
          ? 'This provider uses OAuth auto-registration, so manual app credentials are not supported.'
          : isDisabled
            ? 'A callback is already being created.'
            : undefined;

        return (
          <div key={provider.id} title={disabledReason} style={{ display: 'flex' }}>
            <GridButton
              type="button"
              disabled={clickDisabled}
              onClick={() => onSelect?.(provider)}
            >
              <Avatar
                entity={{
                  name: provider.name ?? provider.slug ?? 'Provider',
                  imageUrl: provider.imageUrl
                }}
                size={24}
                radius={8}
                noTooltip
                imageFit="contain"
              />

              <ProviderName>{provider.name ?? provider.slug ?? 'Provider'}</ProviderName>
            </GridButton>
          </div>
        );
      })}
    </Grid>
  );
};

let ProviderSearchGrid = ({
  items,
  onSelect,
  stickyTop,
  placeholder = 'Search for providers',
  emptyText = 'No providers found',
  sectionLabel = 'Providers',
  columns,
  selectionMode = 'default',
  variant = 'compactList',
  cardSize = 'default',
  hideSearch = false,
  internalScroll = false,
  internalScrollHeight,
  selectedProviderId,
  creatingProviderId,
  selectionDisabled
}: {
  items: ProviderSearchItem[];
  onSelect?: (provider: ProviderSearchItem) => void;
  stickyTop?: number;
  placeholder?: string;
  emptyText?: string;
  sectionLabel?: string;
  columns?: number;
  selectionMode?: 'default' | 'authCredentialsCreate';
  variant?: ProviderSearchVariant;
  cardSize?: ProviderCardSize;
  hideSearch?: boolean;
  internalScroll?: boolean;
  internalScrollHeight?: string | number;
  selectedProviderId?: string;
  creatingProviderId?: string;
  selectionDisabled?: boolean;
}) => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 300);

  let filteredItems = items.filter(item => {
    if (!searchDebounced) return true;
    let query = searchDebounced.toLowerCase();
    return (
      (item.name ?? '').toLowerCase().includes(query) ||
      (item.slug ?? '').toLowerCase().includes(query) ||
      (item.description ?? '').toLowerCase().includes(query)
    );
  });

  let results = (
    <ProviderItemsGrid
      items={filteredItems}
      emptyText={emptyText}
      columns={columns}
      onSelect={onSelect}
      selectionMode={selectionMode}
      variant={variant}
      cardSize={cardSize}
      selectedProviderId={selectedProviderId}
      creatingProviderId={creatingProviderId}
      selectionDisabled={selectionDisabled}
    />
  );

  return (
    <Wrapper $internalScroll={internalScroll} $internalScrollHeight={internalScrollHeight}>
      {!hideSearch && (
        <>
          <div style={{ position: 'sticky', top: stickyTop ?? 0, zIndex: 1 }}>
            <Input
              label="Search"
              hideLabel
              placeholder={placeholder}
              value={search}
              onInput={setSearch}
            />
          </div>

          <Spacer size={10} />
        </>
      )}

      {internalScroll ? <ScrollBody>{results}</ScrollBody> : results}
    </Wrapper>
  );
};

export let ProviderSearch = ({
  onSelect,
  stickyTop,
  columns,
  limit,
  filter,
  variant = 'compactList',
  cardSize = 'default',
  hideSearch = false,
  internalScroll = false,
  internalScrollHeight,
  selectedProviderId,
  creatingProviderId,
  selectionDisabled
}: {
  onSelect?: (provider: ProviderListingsGetOutput['provider']) => void;
  stickyTop?: number;
  columns?: number;
  limit?: number;
  filter?: DashboardInstanceProviderListingsListQuery;
  variant?: ProviderSearchVariant;
  cardSize?: ProviderCardSize;
  hideSearch?: boolean;
  internalScroll?: boolean;
  internalScrollHeight?: string | number;
  selectedProviderId?: string;
  creatingProviderId?: string;
  selectionDisabled?: boolean;
}) => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);
  let searchQuery = searchDebounced.trim() || undefined;
  let instance = useCurrentInstance();
  let providers = useProviderListings(instance.data?.id, {
    orderByRank: true,
    ...filter,
    ...(searchQuery ? { search: searchQuery } : {}),
    ...(limit ? { limit } : {})
  });

  let content = renderWithPagination(providers)(providers => (
    <ProviderItemsGrid
      items={providers.data.items.map(provider => ({
        id: provider.id,
        name: provider.name,
        slug: provider.slug,
        description: provider.description,
        imageUrl: provider.imageUrl,
        attributes: provider.attributes,
        categories: provider.categories
      }))}
      columns={columns}
      variant={variant}
      cardSize={cardSize}
      selectedProviderId={selectedProviderId}
      creatingProviderId={creatingProviderId}
      selectionDisabled={selectionDisabled}
      onSelect={provider => {
        let selectedProvider = providers.data.items.find(item => item.id === provider.id);
        if (selectedProvider) onSelect?.(selectedProvider.provider);
      }}
    />
  ));

  return (
    <Wrapper $internalScroll={internalScroll} $internalScrollHeight={internalScrollHeight}>
      {!hideSearch && (
        <>
          <div style={{ position: 'sticky', top: stickyTop ?? 0, zIndex: 1 }}>
            <Input
              label="Search"
              hideLabel
              placeholder="Search for providers"
              value={search}
              onInput={setSearch}
            />
          </div>

          <Spacer size={10} />
        </>
      )}

      {internalScroll ? <ScrollBody>{content}</ScrollBody> : content}
    </Wrapper>
  );
};

export let ProvidersWithDeploymentsSearch = ({
  instanceId,
  onSelect,
  stickyTop,
  emptyText = 'No providers found. Create a deployment first.',
  columns,
  limit,
  selectionMode = 'default',
  variant = 'compactList',
  cardSize = 'default',
  includeAllProviders = false,
  prioritizeProvidersWithDeployments = false,
  loadProviderDeployments,
  providerListingsFilter,
  excludeProviderIds,
  hideSearch = false,
  internalScroll = false,
  internalScrollHeight,
  selectedProviderId,
  creatingProviderId,
  selectionDisabled
}: {
  instanceId: string;
  onSelect?: (provider: ProviderSearchItem) => void;
  stickyTop?: number;
  emptyText?: string;
  columns?: number;
  limit?: number;
  selectionMode?: 'default' | 'authCredentialsCreate';
  variant?: ProviderSearchVariant;
  cardSize?: ProviderCardSize;
  includeAllProviders?: boolean;
  prioritizeProvidersWithDeployments?: boolean;
  loadProviderDeployments?: boolean;
  providerListingsFilter?: DashboardInstanceProviderListingsListQuery;
  excludeProviderIds?: string[];
  hideSearch?: boolean;
  internalScroll?: boolean;
  internalScrollHeight?: string | number;
  selectedProviderId?: string;
  creatingProviderId?: string;
  selectionDisabled?: boolean;
}) => {
  let shouldLoadProviderDeployments =
    loadProviderDeployments ?? (!includeAllProviders || prioritizeProvidersWithDeployments);
  let deployments = useProviderDeployments(
    shouldLoadProviderDeployments ? instanceId : null,
    limit ? { limit } : undefined
  );
  let excludedProviderIds = useMemo(() => new Set(excludeProviderIds ?? []), [excludeProviderIds]);
  let providerIds = useMemo(
    () =>
      [
        ...new Set((deployments.data?.items ?? []).map(deployment => deployment.providerId))
      ].sort(),
    [deployments.data?.items]
  );
  let providerListings = useProviderListings(
    instanceId,
    includeAllProviders
      ? {
          ...providerListingsFilter,
          orderByRank: true,
          ...(limit ? { limit } : { limit: 100 })
        }
      : providerIds.length > 0
        ? {
            ...providerListingsFilter,
            orderByRank: true,
            limit: Math.max(providerIds.length, 100)
          }
        : null
  );

  if (includeAllProviders) {
    return renderWithPagination(providerListings, {
      hidePaginationWhenUnavailable: true
    })(providerListings => {
      let deployedProviderIds = new Set(providerIds);
      let providerItems = providerListings.data.items.map((providerListing, idx) => ({
        idx,
        item: {
          id: providerListing.provider.id,
          name: providerListing.name ?? providerListing.provider.name,
          slug: providerListing.slug ?? providerListing.provider.slug,
          description: providerListing.description,
          imageUrl: providerListing.imageUrl,
          attributes: providerListing.attributes,
          categories: providerListing.categories,
          oauthAutoRegistrationEnabled: getProviderOAuthAutoRegistrationEnabled(
            providerListing.provider
          )
        } as ProviderSearchItem
      }));

      let sortedItems = prioritizeProvidersWithDeployments
        ? [...providerItems].sort((a, b) => {
            let aHas = deployedProviderIds.has(a.item.id) ? 1 : 0;
            let bHas = deployedProviderIds.has(b.item.id) ? 1 : 0;
            if (aHas !== bHas) return bHas - aHas;
            return a.idx - b.idx;
          })
        : providerItems;
      let visibleItems = sortedItems
        .map(i => i.item)
        .filter(item => !excludedProviderIds.has(item.id));

      return (
        <ProviderSearchGrid
          items={visibleItems}
          stickyTop={stickyTop}
          sectionLabel="Providers"
          emptyText={emptyText}
          columns={columns}
          onSelect={onSelect}
          selectionMode={selectionMode}
          variant={variant}
          cardSize={cardSize}
          hideSearch={hideSearch}
          internalScroll={internalScroll}
          internalScrollHeight={internalScrollHeight}
          selectedProviderId={selectedProviderId}
          creatingProviderId={creatingProviderId}
          selectionDisabled={selectionDisabled}
        />
      );
    });
  }

  return renderWithPagination(deployments, {
    hidePaginationWhenUnavailable: true
  })(deployments => {
    let providerLookup = new Map<
      string,
      {
        name?: string | null;
        slug?: string | null;
        description?: string | null;
        imageUrl?: string | null;
        oauthAutoRegistrationEnabled?: boolean;
        attributes?: ProviderSearchItem['attributes'];
        categories?: ProviderSearchItem['categories'];
      }
    >();

    for (let providerListing of providerListings.data?.items ?? []) {
      if (!providerIds.includes(providerListing.provider.id)) continue;
      providerLookup.set(providerListing.provider.id, {
        name: providerListing.name ?? providerListing.provider.name,
        slug: providerListing.slug ?? providerListing.provider.slug,
        description: providerListing.description,
        imageUrl: providerListing.imageUrl,
        attributes: providerListing.attributes,
        categories: providerListing.categories,
        oauthAutoRegistrationEnabled: getProviderOAuthAutoRegistrationEnabled(
          providerListing.provider
        )
      });
    }

    let seen = new Set<string>();
    let items: ProviderSearchItem[] = [];

    for (let deployment of deployments.data.items) {
      if (seen.has(deployment.providerId)) continue;
      seen.add(deployment.providerId);
      if (excludedProviderIds.has(deployment.providerId)) continue;

      let provider = providerLookup.get(deployment.providerId);

      items.push({
        id: deployment.providerId,
        name: provider?.name ?? deployment.providerId,
        slug: provider?.slug ?? null,
        description: provider?.description ?? null,
        imageUrl: provider?.imageUrl ?? null,
        attributes: provider?.attributes,
        categories: provider?.categories,
        oauthAutoRegistrationEnabled: provider?.oauthAutoRegistrationEnabled
      });
    }

    return (
      <ProviderSearchGrid
        items={items}
        stickyTop={stickyTop}
        sectionLabel="Providers"
        emptyText={emptyText}
        columns={columns}
        onSelect={onSelect}
        selectionMode={selectionMode}
        variant={variant}
        cardSize={cardSize}
        hideSearch={hideSearch}
        internalScroll={internalScroll}
        internalScrollHeight={internalScrollHeight}
        selectedProviderId={selectedProviderId}
        creatingProviderId={creatingProviderId}
        selectionDisabled={selectionDisabled}
      />
    );
  });
};

export let ProviderSearchField = ({
  value,
  label,
  onChange,
  size = '3'
}: {
  value?: { id: string; name: string };
  label?: string;
  onChange?: (provider: ProviderListingsGetOutput['provider']) => void;
  size?: ButtonSize;
}) => {
  let sizeStyles = getButtonSize(size);

  let [isOpen, setIsOpen] = useState(false);

  let [ref, { width }] = useMeasure<HTMLDivElement>();

  return (
    <>
      {label && <InputLabel>{label}</InputLabel>}

      <Popover.Root
        trigger={
          <FieldWrapper style={sizeStyles} ref={ref}>
            {value?.name ?? (
              <span style={{ color: theme.colors.gray700 }}>Select provider</span>
            )}
          </FieldWrapper>
        }
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <Popover.Content
          style={{
            width,
            overflowY: 'auto'
          }}
        >
          <ProviderSearch
            onSelect={provider => {
              onChange?.(provider);
              setIsOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Root>
    </>
  );
};
