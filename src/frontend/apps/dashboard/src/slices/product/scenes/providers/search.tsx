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

let Wrapper = styled.div<{
  $internalScroll?: boolean;
  $internalScrollHeight?: string | number;
}>`
  ${({ $internalScroll, $internalScrollHeight }) =>
    $internalScroll
      ? `
    height: ${
      typeof $internalScrollHeight === 'number'
        ? `${$internalScrollHeight}px`
        : ($internalScrollHeight ?? '100%')
    };
    max-height: ${
      typeof $internalScrollHeight === 'number'
        ? `${$internalScrollHeight}px`
        : ($internalScrollHeight ?? '100%')
    };
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
  scrollbar-gutter: stable;
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
    opacity: 0.55;
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
  &[data-disabled='true'] {
    opacity: 0.55;
  }

  [data-button='true'] {
    &:hover,
    &:focus {
      box-shadow: none;
    }
  }
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
  cardSize = 'default'
}: {
  items: ProviderSearchItem[];
  onSelect?: (provider: ProviderSearchItem) => void;
  emptyText?: string;
  columns?: number;
  selectionMode?: 'default' | 'authCredentialsCreate';
  variant?: ProviderSearchVariant;
  cardSize?: ProviderCardSize;
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
          let isDisabled =
            selectionMode === 'authCredentialsCreate' && provider.oauthAutoRegistrationEnabled;
          let disabledReason = isDisabled
            ? 'This provider uses OAuth auto-registration, so manual app credentials are not supported.'
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
            >
              <ItemGrid.Item
                title={provider.name ?? provider.slug ?? 'Provider'}
                description={description}
                height={cardSize === 'compact' ? 220 : 250}
                onClick={isDisabled ? undefined : () => onSelect?.(provider)}
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
        let isDisabled =
          selectionMode === 'authCredentialsCreate' && provider.oauthAutoRegistrationEnabled;
        let disabledReason = isDisabled
          ? 'This provider uses OAuth auto-registration, so manual app credentials are not supported.'
          : undefined;

        return (
          <div key={provider.id} title={disabledReason} style={{ display: 'flex' }}>
            <GridButton
              type="button"
              disabled={isDisabled}
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
  internalScrollHeight
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
  internalScrollHeight
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
  providerListingsFilter,
  hideSearch = false,
  internalScroll = false,
  internalScrollHeight
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
  providerListingsFilter?: DashboardInstanceProviderListingsListQuery;
  hideSearch?: boolean;
  internalScroll?: boolean;
  internalScrollHeight?: string | number;
}) => {
  let deployments = useProviderDeployments(instanceId, limit ? { limit } : undefined);
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

      return (
        <ProviderSearchGrid
          items={sortedItems.map(i => i.item)}
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
