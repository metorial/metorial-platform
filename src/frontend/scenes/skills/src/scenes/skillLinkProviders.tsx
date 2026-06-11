import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  type IntegrationPreview,
  type SkillItem,
  type SkillTemplateItem,
  useAllProviderListings,
  useAllSkillItems,
  useAllSkillTemplateItems,
  useCreateSkillItem,
  useCreateSkillTemplateItem,
  useDeleteSkillItem,
  useDeleteSkillTemplateItem,
  useIntegrations,
  useProviderListings
} from '@metorial/state';
import {
  Avatar,
  Badge,
  Button,
  Input,
  Menu,
  Panel,
  Text,
  confirm,
  showModal,
  theme
} from '@metorial/ui';
import { Box, ItemGrid, Table } from '@metorial/ui-product';
import { RiAddLine, RiMore2Line } from '@remixicon/react';
import { useMemo, useState } from 'react';
import styled from 'styled-components';

let EmptyState = styled.div`
  line-height: 1.6;
  padding: 8px 0;
`;

let ItemName = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
`;

let Actions = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
`;

let PickerStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let PickerScroll = styled.div`
  max-height: calc(100vh - 205px);
  overflow: auto;
  padding-right: 2px;
`;

let CardCategories = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

let CardCategory = styled.div`
  background: ${theme.colors.gray300};
  min-height: 24px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
`;

let ProviderAvatarStack = styled.div`
  display: flex;
  align-items: center;
`;

let ProviderAvatarItem = styled.div<{ $index: number; $radius: number }>`
  position: relative;
  z-index: ${p => 10 - p.$index};
  margin-left: ${p => (p.$index === 0 ? '0' : '-8px')};
  border-radius: ${p => p.$radius}px;
  box-shadow: 0 0 0 2px ${theme.colors.background};
`;

let truncate = (value: string | null | undefined, length = 100) => {
  if (!value) return undefined;
  if (value.length <= length) return value;
  return `${value.slice(0, length)}...`;
};

type SkillItemPickerKind = 'provider' | 'integration';
type LinkedProviderItem = SkillItem | SkillTemplateItem;

let getSkillItemEntity = (
  item: LinkedProviderItem,
  providerListings: Map<string, { name?: string | null; imageUrl?: string | null }>
) => {
  if (item.type === 'provider' && item.provider) {
    let listing = providerListings.get(item.provider.id);
    let name = listing?.name ?? item.provider.name ?? item.provider.slug;

    return {
      name,
      imageUrl: listing?.imageUrl,
      kind: 'Provider'
    };
  }

  if (item.integration) {
    return {
      name: item.integration.name ?? item.integration.slug,
      imageUrl: `https://avatar-cdn.metorial.com/${item.integration.id}`,
      kind: 'Integration'
    };
  }

  return {
    name: item.id,
    imageUrl: undefined,
    kind: item.type === 'provider' ? 'Provider' : 'Integration'
  };
};

let IntegrationProviderAvatarStack = (p: {
  integration: IntegrationPreview | null | undefined;
  fallbackName: string;
  providerListings: Map<string, { name?: string | null; imageUrl?: string | null }>;
  size?: number;
  radius?: number;
}) => {
  let visibleProviders = (p.integration?.providers ?? []).slice(0, 5);
  let radius = p.radius ?? 8;

  if (visibleProviders.length === 0) {
    return <Avatar entity={{ name: p.fallbackName }} size={p.size ?? 30} radius={radius} />;
  }

  return (
    <ProviderAvatarStack>
      {visibleProviders.map((provider, idx) => {
        let listing = p.providerListings.get(provider.provider.id);
        let name = listing?.name ?? provider.provider.name ?? provider.provider.slug;

        return (
          <ProviderAvatarItem
            key={provider.id ?? provider.provider.id}
            $index={idx}
            $radius={radius}
          >
            <Avatar
              entity={{
                name,
                photoUrl: listing?.imageUrl ?? undefined
              }}
              size={p.size ?? 30}
              radius={radius}
              noTooltip
              imageFit="contain"
            />
          </ProviderAvatarItem>
        );
      })}
    </ProviderAvatarStack>
  );
};

let getSkillItemTableRow = (p: {
  item: LinkedProviderItem;
  providerListings: Map<string, { name?: string | null; imageUrl?: string | null }>;
  integrationLookup: Map<string, IntegrationPreview>;
  isDeleting: boolean;
  onDelete?: (item: LinkedProviderItem) => void;
}) => {
  let entity = getSkillItemEntity(p.item, p.providerListings);
  let linkedIntegration =
    p.item.type === 'integration' && p.item.integration
      ? p.integrationLookup.get(p.item.integration.id)
      : undefined;

  let row = [
    <ItemName>
      {p.item.type === 'integration' ? (
        <IntegrationProviderAvatarStack
          integration={linkedIntegration}
          fallbackName={entity.name}
          providerListings={p.providerListings}
          size={32}
          radius={999}
        />
      ) : (
        <Avatar
          entity={{
            name: entity.name,
            photoUrl: entity.imageUrl ?? undefined
          }}
          size={32}
          radius={999}
          noTooltip
          imageFit="contain"
        />
      )}
      <Text size="2" weight="strong">
        {entity.name}
      </Text>
    </ItemName>,
    <Badge color="gray" size="1">
      {entity.kind}
    </Badge>
  ];

  if (!p.onDelete) return row;

  return [
    ...row,
    <Actions>
      <Menu
        items={[{ id: 'remove', label: 'Remove' }]}
        onItemClick={item => {
          if (item !== 'remove') return;

          confirm({
            title: `Remove ${entity.name}?`,
            description: `Remove ${entity.name} from this skill?`,
            confirmText: 'Remove',
            onConfirm: async () => p.onDelete?.(p.item)
          });
        }}
      >
        <Button
          size="1"
          variant="outline"
          iconRight={<RiMore2Line />}
          loading={p.isDeleting}
          title="Linked item options"
        />
      </Menu>
    </Actions>
  ];
};

let ProviderPicker = (p: {
  instanceId: string;
  excludeProviderIds: string[];
  allowedProviderIds?: string[];
  onSelect: (providerId: string) => void;
  selectedId: string | null;
}) => {
  let [search, setSearch] = useState('');
  let excludedProviderIds = useMemo(
    () => new Set(p.excludeProviderIds),
    [p.excludeProviderIds]
  );
  let hasNoAllowedProviders = p.allowedProviderIds?.length === 0;
  let providers = useProviderListings(
    p.instanceId,
    hasNoAllowedProviders
      ? null
      : {
          orderByRank: true,
          limit: 30,
          ...(p.allowedProviderIds ? { id: p.allowedProviderIds } : {}),
          ...(search.trim() ? { search: search.trim() } : {})
        }
  );

  return (
    <PickerStack>
      <Input
        label="Search providers"
        hideLabel
        placeholder="Search providers..."
        value={search}
        onInput={setSearch}
      />

      <PickerScroll>
        {hasNoAllowedProviders ? (
          <Text size="2" color="gray600">
            No providers are available for this portal.
          </Text>
        ) : (
          renderWithPagination(providers, { hidePaginationWhenUnavailable: true })(
            providers => {
              let items = providers.data.items.filter(
                listing => !excludedProviderIds.has(listing.provider.id)
              );

              if (items.length === 0) {
                return (
                  <Text size="2" color="gray600">
                    {search.trim()
                      ? 'No providers match your search.'
                      : 'All available providers are already linked to this skill.'}
                  </Text>
                );
              }

              return (
                <ItemGrid.Root width="270px">
                  {items.map(listing => {
                    let name = listing.name ?? listing.provider.name ?? listing.provider.slug;

                    return (
                      <ItemGrid.Item
                        key={listing.provider.id}
                        title={name}
                        description={truncate(listing.description)}
                        height={220}
                        onClick={() => {
                          if (!p.selectedId) p.onSelect(listing.provider.id);
                        }}
                        icon={
                          <Avatar
                            entity={{
                              name,
                              photoUrl: listing.imageUrl ?? undefined
                            }}
                            size={30}
                            radius={5}
                            noTooltip
                            imageFit="contain"
                          />
                        }
                        bottom={
                          <CardCategories>
                            {(listing.categories ?? []).slice(0, 2).map(category => (
                              <CardCategory key={category.id}>{category.name}</CardCategory>
                            ))}
                          </CardCategories>
                        }
                      />
                    );
                  })}
                </ItemGrid.Root>
              );
            }
          )
        )}
      </PickerScroll>
    </PickerStack>
  );
};

let IntegrationPicker = (p: {
  instanceId: string;
  excludeIntegrationIds: string[];
  allowedIntegrationIds?: string[];
  onSelect: (integrationId: string) => void;
  selectedId: string | null;
}) => {
  let [search, setSearch] = useState('');
  let excludedIntegrationIds = useMemo(
    () => new Set(p.excludeIntegrationIds),
    [p.excludeIntegrationIds]
  );
  let hasNoAllowedIntegrations = p.allowedIntegrationIds?.length === 0;
  let integrations = useIntegrations(hasNoAllowedIntegrations ? null : p.instanceId, {
    order: 'desc',
    status: ['active'],
    limit: 30,
    ...(p.allowedIntegrationIds ? { id: p.allowedIntegrationIds } : {}),
    ...(search.trim() ? { search: search.trim() } : {})
  });
  let providerIds = useMemo(
    () =>
      [
        ...new Set(
          (integrations.data?.items ?? []).flatMap(integration =>
            (integration.providers ?? []).map(provider => provider.provider.id)
          )
        )
      ].sort(),
    [integrations.data?.items]
  );
  let providerListings = useAllProviderListings(p.instanceId, providerIds);

  return (
    <PickerStack>
      <Input
        label="Search integrations"
        hideLabel
        placeholder="Search integrations..."
        value={search}
        onInput={setSearch}
      />

      <PickerScroll>
        {hasNoAllowedIntegrations ? (
          <Text size="2" color="gray600">
            No integrations are available for this portal.
          </Text>
        ) : (
          renderWithPagination(integrations, { hidePaginationWhenUnavailable: true })(
            integrations =>
              renderWithLoader({ providerListings })(({ providerListings }) => {
                let listingLookup = new Map<
                  string,
                  { name: string | null | undefined; imageUrl: string | null | undefined }
                >();

                for (let listing of providerListings.data) {
                  let preview = {
                    name: listing.name ?? listing.provider.name,
                    imageUrl: listing.imageUrl
                  };

                  listingLookup.set(listing.id, preview);
                  listingLookup.set(listing.provider.id, preview);
                }

                let items = integrations.data.items.filter(
                  integration => !excludedIntegrationIds.has(integration.id)
                );

                if (items.length === 0) {
                  return (
                    <Text size="2" color="gray600">
                      {search.trim()
                        ? 'No integrations match your search.'
                        : 'All available integrations are already linked to this skill.'}
                    </Text>
                  );
                }

                return (
                  <ItemGrid.Root width="270px">
                    {items.map((integration: IntegrationPreview) => (
                      <ItemGrid.Item
                        key={integration.id}
                        title={integration.name}
                        description={truncate(integration.description)}
                        height={220}
                        onClick={() => {
                          if (!p.selectedId) p.onSelect(integration.id);
                        }}
                        icon={
                          <IntegrationProviderAvatarStack
                            integration={integration}
                            fallbackName={integration.name}
                            providerListings={listingLookup}
                          />
                        }
                        bottom={
                          <CardCategories>
                            <CardCategory>{integration.slug}</CardCategory>
                          </CardCategories>
                        }
                      />
                    ))}
                  </ItemGrid.Root>
                );
              })
          )
        )}
      </PickerScroll>
    </PickerStack>
  );
};

let SkillItemPickerPanel = (p: {
  kind: SkillItemPickerKind;
  instanceId: string;
  skillId: string;
  excludeProviderIds: string[];
  excludeIntegrationIds: string[];
  allowedProviderIds?: string[];
  allowedIntegrationIds?: string[];
  close: () => void;
  onComplete: () => Promise<void> | void;
}) => {
  let createSkillItem = useCreateSkillItem();
  let [selectedId, setSelectedId] = useState<string | null>(null);
  let isProvider = p.kind === 'provider';

  let handleSelect = async (id: string) => {
    if (selectedId) return;
    setSelectedId(id);

    let [created] = await createSkillItem.mutate(
      isProvider
        ? {
            instanceId: p.instanceId,
            skillId: p.skillId,
            type: 'provider',
            providerId: id
          }
        : {
            instanceId: p.instanceId,
            skillId: p.skillId,
            type: 'integration',
            integrationId: id
          }
    );

    if (created) {
      await p.onComplete();
      p.close();
      return;
    }

    setSelectedId(null);
  };

  return (
    <>
      <Panel.Header>
        <div>
          <Panel.Title>{isProvider ? 'Add Provider' : 'Add Integration'}</Panel.Title>
          <Panel.Description>
            {isProvider
              ? 'Choose a provider to link directly to this skill.'
              : 'Choose an integration to link to this skill.'}
          </Panel.Description>
        </div>
      </Panel.Header>

      <Panel.Content>
        {isProvider ? (
          <ProviderPicker
            instanceId={p.instanceId}
            excludeProviderIds={p.excludeProviderIds}
            allowedProviderIds={p.allowedProviderIds}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        ) : (
          <IntegrationPicker
            instanceId={p.instanceId}
            excludeIntegrationIds={p.excludeIntegrationIds}
            allowedIntegrationIds={p.allowedIntegrationIds}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        )}

        <createSkillItem.RenderError />
      </Panel.Content>
    </>
  );
};

let showSkillItemPickerPanel = (p: {
  kind: SkillItemPickerKind;
  instanceId: string;
  skillId: string;
  excludeProviderIds: string[];
  excludeIntegrationIds: string[];
  allowedProviderIds?: string[];
  allowedIntegrationIds?: string[];
  onComplete: () => Promise<void> | void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={1050}>
      <SkillItemPickerPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let SkillTemplateItemPickerPanel = (p: {
  kind: SkillItemPickerKind;
  instanceId: string;
  skillTemplateId: string;
  excludeProviderIds: string[];
  excludeIntegrationIds: string[];
  allowedProviderIds?: string[];
  allowedIntegrationIds?: string[];
  close: () => void;
  onComplete: () => Promise<void> | void;
}) => {
  let createSkillTemplateItem = useCreateSkillTemplateItem();
  let [selectedId, setSelectedId] = useState<string | null>(null);
  let isProvider = p.kind === 'provider';

  let handleSelect = async (id: string) => {
    if (selectedId) return;
    setSelectedId(id);

    let [created] = await createSkillTemplateItem.mutate(
      isProvider
        ? {
            instanceId: p.instanceId,
            skillTemplateId: p.skillTemplateId,
            type: 'provider',
            providerId: id
          }
        : {
            instanceId: p.instanceId,
            skillTemplateId: p.skillTemplateId,
            type: 'integration',
            integrationId: id
          }
    );

    if (created) {
      await p.onComplete();
      p.close();
      return;
    }

    setSelectedId(null);
  };

  return (
    <>
      <Panel.Header>
        <div>
          <Panel.Title>{isProvider ? 'Add Provider' : 'Add Integration'}</Panel.Title>
          <Panel.Description>
            {isProvider
              ? 'Choose a provider to include in this skill template.'
              : 'Choose an integration to include in this skill template.'}
          </Panel.Description>
        </div>
      </Panel.Header>

      <Panel.Content>
        {isProvider ? (
          <ProviderPicker
            instanceId={p.instanceId}
            excludeProviderIds={p.excludeProviderIds}
            allowedProviderIds={p.allowedProviderIds}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        ) : (
          <IntegrationPicker
            instanceId={p.instanceId}
            excludeIntegrationIds={p.excludeIntegrationIds}
            allowedIntegrationIds={p.allowedIntegrationIds}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        )}

        <createSkillTemplateItem.RenderError />
      </Panel.Content>
    </>
  );
};

let showSkillTemplateItemPickerPanel = (p: {
  kind: SkillItemPickerKind;
  instanceId: string;
  skillTemplateId: string;
  excludeProviderIds: string[];
  excludeIntegrationIds: string[];
  allowedProviderIds?: string[];
  allowedIntegrationIds?: string[];
  onComplete: () => Promise<void> | void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={1050}>
      <SkillTemplateItemPickerPanel {...p} close={close} />
    </Panel.Wrapper>
  ));

let AddSkillItemMenu = (p: {
  disabled?: boolean;
  onSelect: (kind: SkillItemPickerKind) => void;
}) => (
  <Menu
    items={[
      { id: 'provider', label: 'Provider', description: 'Link an individual provider.' },
      {
        id: 'integration',
        label: 'Integration',
        description: 'Link an integration with multiple providers.'
      }
    ]}
    onItemClick={item => {
      if (item === 'provider' || item === 'integration') p.onSelect(item);
    }}
  >
    <Button size="2" iconLeft={<RiAddLine />} disabled={p.disabled} variant="outline">
      Add Provider
    </Button>
  </Menu>
);

export let SkillLinkProvidersScene = (p: {
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
  allowedProviderIds?: string[];
  allowedIntegrationIds?: string[];
}) => {
  let skillItems = useAllSkillItems(p.instanceId, p.skillId, {
    order: 'asc',
    status: ['active']
  });
  let deleteSkillItem = useDeleteSkillItem();
  let providerIds = useMemo(
    () =>
      [
        ...new Set(
          (skillItems.data ?? []).flatMap(item =>
            item.type === 'provider' && item.provider ? [item.provider.id] : []
          )
        )
      ].sort(),
    [skillItems.data]
  );
  let linkedProviderIds = useMemo(
    () =>
      (skillItems.data ?? []).flatMap(item =>
        item.type === 'provider' && item.provider ? [item.provider.id] : []
      ),
    [skillItems.data]
  );
  let linkedIntegrationIds = useMemo(
    () =>
      (skillItems.data ?? []).flatMap(item =>
        item.type === 'integration' && item.integration ? [item.integration.id] : []
      ),
    [skillItems.data]
  );
  let linkedIntegrations = useIntegrations(
    linkedIntegrationIds.length > 0 ? p.instanceId : null,
    {
      id: linkedIntegrationIds,
      limit: Math.max(linkedIntegrationIds.length, 1),
      status: ['active', 'archived']
    }
  );
  let integrationProviderIds = useMemo(
    () =>
      [
        ...new Set(
          (linkedIntegrations.data?.items ?? []).flatMap(integration =>
            (integration.providers ?? []).map(provider => provider.provider.id)
          )
        )
      ].sort(),
    [linkedIntegrations.data?.items]
  );
  let allProviderIds = useMemo(
    () => [...new Set([...providerIds, ...integrationProviderIds])].sort(),
    [integrationProviderIds, providerIds]
  );
  let providerListings = useAllProviderListings(p.instanceId, allProviderIds);

  let openPicker = (kind: SkillItemPickerKind) => {
    if (!p.instanceId || !p.skillId) return;

    showSkillItemPickerPanel({
      kind,
      instanceId: p.instanceId,
      skillId: p.skillId,
      excludeProviderIds: linkedProviderIds,
      excludeIntegrationIds: linkedIntegrationIds,
      allowedProviderIds: p.allowedProviderIds,
      allowedIntegrationIds: p.allowedIntegrationIds,
      onComplete: async () => {
        await skillItems.refetch();
      }
    });
  };

  let deleteItem = async (item: SkillItem) => {
    if (!p.instanceId || !p.skillId) return;

    let [deleted] = await deleteSkillItem.mutate({
      instanceId: p.instanceId,
      skillId: p.skillId,
      skillItemId: item.id
    });
    if (deleted) await skillItems.refetch();
  };

  return renderWithLoader({ skillItems, providerListings })(
    ({ skillItems, providerListings }) => {
      let providerListingLookup = new Map<
        string,
        { name?: string | null; imageUrl?: string | null }
      >();
      let integrationLookup = new Map<string, IntegrationPreview>();

      for (let listing of providerListings.data) {
        providerListingLookup.set(listing.id, {
          name: listing.name ?? listing.provider.name,
          imageUrl: listing.imageUrl
        });
        providerListingLookup.set(listing.provider.id, {
          name: listing.name ?? listing.provider.name,
          imageUrl: listing.imageUrl
        });
      }

      for (let integration of linkedIntegrations.data?.items ?? []) {
        integrationLookup.set(integration.id, integration);
      }

      return (
        <Box
          title="Providers"
          description="Link providers and integrations to be used with this skill."
          rightActions={
            <AddSkillItemMenu disabled={!p.instanceId || !p.skillId} onSelect={openPicker} />
          }
        >
          {skillItems.data.length === 0 ? (
            <EmptyState>
              <Text color="gray600" size="2">
                No providers or integrations are linked to this skill yet.
              </Text>
            </EmptyState>
          ) : (
            <>
              <Table
                headers={['Name', 'Type', '']}
                data={skillItems.data.map(item =>
                  getSkillItemTableRow({
                    item,
                    providerListings: providerListingLookup,
                    integrationLookup,
                    isDeleting: deleteSkillItem.isLoading,
                    onDelete: item => deleteItem(item as SkillItem)
                  })
                )}
              />
              <deleteSkillItem.RenderError />
            </>
          )}
        </Box>
      );
    }
  );
};

export let SkillTemplateLinkProvidersScene = (p: {
  instanceId: string | null | undefined;
  skillTemplateId: string | null | undefined;
  readOnly?: boolean;
  allowedProviderIds?: string[];
  allowedIntegrationIds?: string[];
}) => {
  let skillTemplateItems = useAllSkillTemplateItems(p.instanceId, p.skillTemplateId, {
    order: 'asc'
  });
  let deleteSkillTemplateItem = useDeleteSkillTemplateItem();
  let providerIds = useMemo(
    () =>
      [
        ...new Set(
          (skillTemplateItems.data ?? []).flatMap(item =>
            item.type === 'provider' && item.provider ? [item.provider.id] : []
          )
        )
      ].sort(),
    [skillTemplateItems.data]
  );
  let linkedProviderIds = useMemo(
    () =>
      (skillTemplateItems.data ?? []).flatMap(item =>
        item.type === 'provider' && item.provider ? [item.provider.id] : []
      ),
    [skillTemplateItems.data]
  );
  let linkedIntegrationIds = useMemo(
    () =>
      (skillTemplateItems.data ?? []).flatMap(item =>
        item.type === 'integration' && item.integration ? [item.integration.id] : []
      ),
    [skillTemplateItems.data]
  );
  let linkedIntegrations = useIntegrations(
    linkedIntegrationIds.length > 0 ? p.instanceId : null,
    {
      id: linkedIntegrationIds,
      limit: Math.max(linkedIntegrationIds.length, 1),
      status: ['active', 'archived']
    }
  );
  let integrationProviderIds = useMemo(
    () =>
      [
        ...new Set(
          (linkedIntegrations.data?.items ?? []).flatMap(integration =>
            (integration.providers ?? []).map(provider => provider.provider.id)
          )
        )
      ].sort(),
    [linkedIntegrations.data?.items]
  );
  let allProviderIds = useMemo(
    () => [...new Set([...providerIds, ...integrationProviderIds])].sort(),
    [integrationProviderIds, providerIds]
  );
  let providerListings = useAllProviderListings(p.instanceId, allProviderIds);

  let openPicker = (kind: SkillItemPickerKind) => {
    if (!p.instanceId || !p.skillTemplateId) return;

    showSkillTemplateItemPickerPanel({
      kind,
      instanceId: p.instanceId,
      skillTemplateId: p.skillTemplateId,
      excludeProviderIds: linkedProviderIds,
      excludeIntegrationIds: linkedIntegrationIds,
      allowedProviderIds: p.allowedProviderIds,
      allowedIntegrationIds: p.allowedIntegrationIds,
      onComplete: async () => {
        await skillTemplateItems.refetch();
      }
    });
  };

  let deleteItem = async (item: LinkedProviderItem) => {
    if (!p.instanceId || !p.skillTemplateId) return;

    let [deleted] = await deleteSkillTemplateItem.mutate({
      instanceId: p.instanceId,
      skillTemplateId: p.skillTemplateId,
      skillTemplateItemId: item.id
    });
    if (deleted) await skillTemplateItems.refetch();
  };

  return renderWithLoader({ skillTemplateItems, providerListings })(
    ({ skillTemplateItems, providerListings }) => {
      let providerListingLookup = new Map<
        string,
        { name?: string | null; imageUrl?: string | null }
      >();
      let integrationLookup = new Map<string, IntegrationPreview>();

      for (let listing of providerListings.data) {
        providerListingLookup.set(listing.id, {
          name: listing.name ?? listing.provider.name,
          imageUrl: listing.imageUrl
        });
        providerListingLookup.set(listing.provider.id, {
          name: listing.name ?? listing.provider.name,
          imageUrl: listing.imageUrl
        });
      }

      for (let integration of linkedIntegrations.data?.items ?? []) {
        integrationLookup.set(integration.id, integration);
      }

      return (
        <Box
          title="Template Providers"
          description="Add providers and integrations that should be included when this template is used."
          rightActions={
            p.readOnly ? undefined : (
              <AddSkillItemMenu
                disabled={!p.instanceId || !p.skillTemplateId}
                onSelect={openPicker}
              />
            )
          }
        >
          {skillTemplateItems.data.length === 0 ? (
            <EmptyState>
              <Text color="gray600" size="2">
                No providers or integrations are linked to this template yet.
              </Text>
            </EmptyState>
          ) : (
            <>
              <Table
                headers={p.readOnly ? ['Name', 'Type'] : ['Name', 'Type', '']}
                data={skillTemplateItems.data.map(item =>
                  getSkillItemTableRow({
                    item,
                    providerListings: providerListingLookup,
                    integrationLookup,
                    isDeleting: deleteSkillTemplateItem.isLoading,
                    onDelete: p.readOnly ? undefined : deleteItem
                  })
                )}
              />
              {!p.readOnly && <deleteSkillTemplateItem.RenderError />}
            </>
          )}
        </Box>
      );
    }
  );
};
