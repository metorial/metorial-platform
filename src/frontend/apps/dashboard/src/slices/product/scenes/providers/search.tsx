import type { DashboardInstanceProvidersListOutput } from '@metorial/dashboard-sdk';
import { renderWithPagination, useForm } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderDeployments, useProviders } from '@metorial/state';
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

type Provider = DashboardInstanceProvidersListOutput['items'][number];

export type ProviderSearchItem = {
  id: string;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
};

let Wrapper = styled.div``;

let Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
`;

let GridButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: none;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  text-align: left;
  transition:
    border-color 0.15s,
    background 0.15s;
  min-width: 0;

  &:hover {
    border-color: ${theme.colors.gray500};
  }
`;

let ProviderName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray800};
  min-width: 0;
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

let ProviderSearchGrid = ({
  items,
  onSelect,
  stickyTop,
  placeholder = 'Search for providers',
  emptyText = 'No providers found',
  sectionLabel = 'Providers'
}: {
  items: ProviderSearchItem[];
  onSelect?: (provider: ProviderSearchItem) => void;
  stickyTop?: number;
  placeholder?: string;
  emptyText?: string;
  sectionLabel?: string;
}) => {
  let form = useForm({
    initialValues: {
      search: ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        search: yup.string().defined()
      })
  });
  let searchDebounced = useDebounced(form.values.search, 300);

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
          value={form.values.search}
          onInput={value => form.setFieldValue('search', value)}
        />
      </div>

      <Spacer size={10} />

      <Or text={sectionLabel} />

      <Spacer size={10} />

      {filteredItems.length === 0 ? (
        <Text size="1" color="gray600">
          {emptyText}
        </Text>
      ) : (
        <Grid>
          {filteredItems.map(provider => (
            <GridButton key={provider.id} type="button" onClick={() => onSelect?.(provider)}>
              <Avatar
                entity={{
                  name: provider.name ?? provider.slug ?? 'Provider'
                }}
                size={24}
                radius={8}
                noTooltip
              />

              <ProviderName>{provider.name ?? provider.slug ?? 'Provider'}</ProviderName>
            </GridButton>
          ))}
        </Grid>
      )}
    </Wrapper>
  );
};

export let ProviderSearch = ({
  onSelect,
  stickyTop
}: {
  onSelect?: (provider: Provider) => void;
  stickyTop?: number;
}) => {
  let instance = useCurrentInstance();
  let providers = useProviders(instance.data?.id);

  return renderWithPagination(providers)(providers => (
    <ProviderSearchGrid
      items={providers.data.items.map(provider => ({
        id: provider.id,
        name: provider.name,
        slug: provider.slug,
        description: provider.description
      }))}
      stickyTop={stickyTop}
      sectionLabel="Providers"
      onSelect={provider => {
        let selectedProvider = providers.data.items.find(item => item.id === provider.id);
        if (selectedProvider) onSelect?.(selectedProvider);
      }}
    />
  ));
};

export let ProvidersWithDeploymentsSearch = ({
  instanceId,
  onSelect,
  stickyTop,
  emptyText = 'No providers found. Create a deployment first.'
}: {
  instanceId: string;
  onSelect?: (provider: ProviderSearchItem) => void;
  stickyTop?: number;
  emptyText?: string;
}) => {
  let deployments = useProviderDeployments(instanceId);
  let providerIds = useMemo(
    () =>
      [
        ...new Set((deployments.data?.items ?? []).map(deployment => deployment.providerId))
      ].sort(),
    [deployments.data?.items]
  );
  let providers = useProviders(
    instanceId,
    providerIds.length > 0 ? { id: providerIds } : null
  );

  return renderWithPagination(deployments)(deployments => {
    let providerLookup = new Map<
      string,
      { name?: string | null; slug?: string | null }
    >();

    for (let provider of providers.data?.items ?? []) {
      providerLookup.set(provider.id, {
        name: provider.name,
        slug: provider.slug
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
        slug: provider?.slug ?? null
      });
    }

    return (
      <ProviderSearchGrid
        items={items}
        stickyTop={stickyTop}
        sectionLabel="Providers"
        emptyText={emptyText}
        onSelect={onSelect}
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
  onChange?: (provider: Provider) => void;
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
