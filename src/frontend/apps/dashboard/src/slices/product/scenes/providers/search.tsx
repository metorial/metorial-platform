import type {
  DashboardInstanceProviderListingsListQuery,
  DashboardInstanceProvidersListOutput,
  ProviderListingsGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { useProviderDeployments, useProviderListings } from '@metorial/state';
import {
  Avatar,
  ButtonSize,
  getButtonSize,
  Input,
  InputLabel,
  Or,
  Popover,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { useMemo, useState } from 'react';
import { useMeasure } from 'react-use';
import styled from 'styled-components';
import { useDebounced } from '../../../../hooks/useDebounced';
import { getProviderOAuthAutoRegistrationEnabled } from '../../lib/providerOAuthAutoRegistration';

type Provider = DashboardInstanceProvidersListOutput['items'][number];

export type ProviderSearchItem = {
  id: string;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  oauthAutoRegistrationEnabled?: boolean;
};

let Wrapper = styled.div``;

let Grid = styled.div<{ $columns?: number }>`
  display: grid;
  grid-template-columns: ${({ $columns }) =>
    $columns ? `repeat(${$columns}, minmax(0, 1fr))` : 'repeat(auto-fill, minmax(150px, 1fr))'};
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
  selectionMode = 'default'
}: {
  items: ProviderSearchItem[];
  onSelect?: (provider: ProviderSearchItem) => void;
  emptyText?: string;
  columns?: number;
  selectionMode?: 'default' | 'authCredentialsCreate';
}) => {
  if (items.length === 0) {
    return (
      <Text size="1" color="gray600">
        {emptyText}
      </Text>
    );
  }

  return (
    <Grid $columns={columns}>
      {items.map(provider => {
        let isDisabled =
          selectionMode === 'authCredentialsCreate' &&
          provider.oauthAutoRegistrationEnabled;
        let disabledReason = isDisabled
          ? 'This provider uses OAuth auto-registration, so manual app credentials are not supported.'
          : undefined;

        return (
          <div
            key={provider.id}
            title={disabledReason}
            style={{ display: 'flex' }}
          >
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
  selectionMode = 'default'
}: {
  items: ProviderSearchItem[];
  onSelect?: (provider: ProviderSearchItem) => void;
  stickyTop?: number;
  placeholder?: string;
  emptyText?: string;
  sectionLabel?: string;
  columns?: number;
  selectionMode?: 'default' | 'authCredentialsCreate';
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

  return (
    <Wrapper>
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

      <Or text={sectionLabel} />

      <Spacer size={10} />

      <ProviderItemsGrid
        items={filteredItems}
        emptyText={emptyText}
        columns={columns}
        onSelect={onSelect}
        selectionMode={selectionMode}
      />
    </Wrapper>
  );
};

export let ProviderSearch = ({
  onSelect,
  stickyTop,
  columns,
  limit,
  filter
}: {
  onSelect?: (provider: ProviderListingsGetOutput['provider']) => void;
  stickyTop?: number;
  columns?: number;
  limit?: number;
  filter?: DashboardInstanceProviderListingsListQuery;
}) => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);
  let searchQuery = searchDebounced.trim() || undefined;
  let providers = useProviderListings({
    orderByRank: true,
    ...filter,
    ...(searchQuery ? { search: searchQuery } : {}),
    ...(limit ? { limit } : {})
  });

  return (
    <Wrapper>
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

      <Or text="Providers" />

      <Spacer size={10} />

      {renderWithPagination(providers)(providers => (
        <ProviderItemsGrid
          items={providers.data.items.map(provider => ({
            id: provider.id,
            name: provider.name,
            slug: provider.slug,
            description: provider.description,
            imageUrl: provider.imageUrl
          }))}
          columns={columns}
          onSelect={provider => {
            let selectedProvider = providers.data.items.find(item => item.id === provider.id);
            if (selectedProvider) onSelect?.(selectedProvider.provider);
          }}
        />
      ))}
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
  selectionMode = 'default'
}: {
  instanceId: string;
  onSelect?: (provider: ProviderSearchItem) => void;
  stickyTop?: number;
  emptyText?: string;
  columns?: number;
  limit?: number;
  selectionMode?: 'default' | 'authCredentialsCreate';
}) => {
  let deployments = useProviderDeployments(instanceId, limit ? { limit } : undefined);
  let providerIds = useMemo(
    () =>
      [...new Set((deployments.data?.items ?? []).map(deployment => deployment.providerId))].sort(),
    [deployments.data?.items]
  );
  let providerListings = useProviderListings(
    providerIds.length > 0
      ? {
          orderByRank: true,
          limit: Math.max(providerIds.length, 100)
        }
      : null
  );

  return renderWithPagination(deployments, {
    hidePaginationWhenUnavailable: true
  })(deployments => {
    let providerLookup = new Map<
      string,
      {
        name?: string | null;
        slug?: string | null;
        imageUrl?: string | null;
        oauthAutoRegistrationEnabled?: boolean;
      }
    >();

    for (let providerListing of providerListings.data?.items ?? []) {
      if (!providerIds.includes(providerListing.provider.id)) continue;
      providerLookup.set(providerListing.provider.id, {
        name: providerListing.name ?? providerListing.provider.name,
        slug: providerListing.slug ?? providerListing.provider.slug,
        imageUrl: providerListing.imageUrl,
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
        imageUrl: provider?.imageUrl ?? null,
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
