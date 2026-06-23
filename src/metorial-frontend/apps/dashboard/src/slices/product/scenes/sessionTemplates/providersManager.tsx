import { DashboardInstanceSessionTemplatesProvidersListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useDeleteSessionTemplateProvider,
  useProviderAuthConfigs,
  useProviderDeployments,
  useProviderListings,
  useSessionTemplateProviders
} from '@metorial/state';
import {
  Avatar,
  Button,
  Dialog,
  Flex,
  RenderDate,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine, RiPencilLine } from '@remixicon/react';
import { type ReactNode, useMemo, useState } from 'react';
import { EmptyState } from '../../../../components/emptyState';
import { Table as DashboardTable } from '../../../../components/table';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';
import {
  type ProviderPanelSubmitInput,
  showAddProviderPanelFlow
} from './addProviderPanelFlow';

type SessionTemplateProviderRow =
  DashboardInstanceSessionTemplatesProvidersListOutput['items'][number];

type SessionTemplateProviderToolFilter = SessionTemplateProviderRow['toolFilter'] | null;

type SessionTemplateProvidersTableProps = {
  instanceId: string;
  sessionTemplateId: string;
  providers: ReturnType<typeof useSessionTemplateProviders>;
  listingLookup: Record<string, { name: string; imageUrl: string }>;
  deploymentLookup: Record<string, string>;
  authConfigNameLookup: Record<string, string>;
  emptyState?: () => ReactNode;
};

type SessionTemplateProvidersTableHookState = {
  instanceId: string;
  sessionTemplateId: string;
  providers: ReturnType<typeof useSessionTemplateProviders>;
  listingLookup: Record<string, { name: string; imageUrl: string }>;
};

type ToolFilterSummaryState = {
  selectedToolKeys: string[];
  hasUnsupportedFilters: boolean;
};

let getToolFilterSummaryState = (
  toolFilter: SessionTemplateProviderToolFilter
): ToolFilterSummaryState => {
  if (!toolFilter || toolFilter.type === 'allow_all') {
    return {
      selectedToolKeys: [],
      hasUnsupportedFilters: false
    };
  }

  let selectedToolKeySet = new Set<string>();
  let hasUnsupportedFilters = false;

  for (let filter of toolFilter.filters) {
    if (filter.type === 'tool_keys') {
      for (let key of filter.keys) {
        selectedToolKeySet.add(key);
      }
      continue;
    }

    hasUnsupportedFilters = true;
  }

  return {
    selectedToolKeys: Array.from(selectedToolKeySet),
    hasUnsupportedFilters
  };
};

let getToolFilterSummary = (toolFilter: SessionTemplateProviderToolFilter) => {
  if (!toolFilter || toolFilter.type === 'allow_all') return 'All tools';

  let summary = getToolFilterSummaryState(toolFilter);
  if (summary.hasUnsupportedFilters && summary.selectedToolKeys.length > 0) {
    return `Custom + ${summary.selectedToolKeys.length} selected`;
  }

  if (summary.hasUnsupportedFilters) return 'Custom filter';
  if (summary.selectedToolKeys.length === 0) return 'No tools';
  if (summary.selectedToolKeys.length === 1) return '1 selected';

  return `${summary.selectedToolKeys.length} selected`;
};

let getProviderId = (provider: SessionTemplateProviderRow) =>
  provider.providerId ?? provider.deployment.providerId ?? provider.config.providerId;

let getProviderDisplayName = (
  provider: SessionTemplateProviderRow,
  listingLookup: Record<string, { name: string; imageUrl: string }>
) => {
  let providerId = getProviderId(provider);
  let listing = providerId ? listingLookup[providerId] : undefined;
  return listing?.name ?? providerId ?? 'Provider';
};

let getProviderListing = (
  provider: SessionTemplateProviderRow,
  listingLookup: Record<string, { name: string; imageUrl: string }>
) => {
  let providerId = getProviderId(provider);
  return providerId ? listingLookup[providerId] : undefined;
};

export let showAddProviderSidePanel = (p: {
  instanceId: string;
  sessionTemplateId?: string;
  onComplete: () => void;
  sessionTemplateProviderId?: string;
  excludeProviderIds?: string[];
  providerId?: string;
  hideProviderStep?: boolean;
  initialDeploymentId?: string;
  initialConfigId?: string;
  initialAuthConfigId?: string;
  initialToolFilter?: SessionTemplateProviderToolFilter;
  filterAvailableResources?: boolean;
  title?: string;
  description?: string;
  action?: string;
  onSubmitProvider?: (
    input: ProviderPanelSubmitInput,
    currentProviderId?: string
  ) => Promise<{ error?: unknown; success?: boolean }>;
}) => showAddProviderPanelFlow(p);

export let showAddProviderModal = showAddProviderSidePanel;

let showRemoveProviderModal = (p: {
  instanceId: string;
  sessionTemplateId: string;
  provider: SessionTemplateProviderRow;
  displayName: string;
  onComplete: () => void;
}) =>
  new Promise<boolean>(resolve => {
    let settled = false;
    let finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    showModal(
      ({ dialogProps, close }) => {
        let [loading, setLoading] = useState(false);
        let deleteMutation = useDeleteSessionTemplateProvider();

        return (
          <Dialog.Wrapper {...dialogProps} width={450}>
            <Dialog.Title>Remove Provider</Dialog.Title>
            <Dialog.Description>
              Are you sure you want to remove <strong>{p.displayName}</strong> from this
              template? Sessions created from this template will no longer include this
              provider.
            </Dialog.Description>

            <Spacer size={20} />

            <Dialog.Actions>
              <Button
                variant="outline"
                onClick={() => {
                  finish(false);
                  close();
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                color="red"
                loading={loading}
                onClick={async () => {
                  setLoading(true);
                  let [, err] = await deleteMutation.mutate({
                    instanceId: p.instanceId,
                    sessionTemplateId: p.sessionTemplateId,
                    sessionTemplateProviderId: p.provider.id
                  });

                  if (!err) {
                    p.onComplete();
                    finish(true);
                    close();
                    return;
                  }

                  setLoading(false);
                }}
              >
                Remove
              </Button>
            </Dialog.Actions>
          </Dialog.Wrapper>
        );
      },
      {
        onClose: () => finish(false)
      }
    );
  });

let showBulkRemoveProvidersModal = (p: {
  instanceId: string;
  sessionTemplateId: string;
  sessionTemplateProviderIds: string[];
  onComplete: () => void;
}) =>
  new Promise<boolean>(resolve => {
    let settled = false;
    let finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    showModal(
      ({ dialogProps, close }) => {
        let [loading, setLoading] = useState(false);
        let deleteMutation = useDeleteSessionTemplateProvider();
        let providerCount = p.sessionTemplateProviderIds.length;
        let providerLabel = providerCount === 1 ? 'provider' : 'providers';

        return (
          <Dialog.Wrapper {...dialogProps} width={460}>
            <Dialog.Title>
              Remove Selected {providerCount === 1 ? 'Provider' : 'Providers'}
            </Dialog.Title>
            <Dialog.Description>
              Remove <strong>{providerCount}</strong> selected {providerLabel} from this
              template?
            </Dialog.Description>

            <Spacer size={20} />

            <Dialog.Actions>
              <Button
                variant="outline"
                onClick={() => {
                  finish(false);
                  close();
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                color="red"
                loading={loading}
                onClick={async () => {
                  setLoading(true);

                  for (let sessionTemplateProviderId of p.sessionTemplateProviderIds) {
                    let [, err] = await deleteMutation.mutate({
                      instanceId: p.instanceId,
                      sessionTemplateId: p.sessionTemplateId,
                      sessionTemplateProviderId
                    });
                    if (err) {
                      setLoading(false);
                      return;
                    }
                  }

                  p.onComplete();
                  finish(true);
                  close();
                }}
              >
                Delete
              </Button>
            </Dialog.Actions>
          </Dialog.Wrapper>
        );
      },
      {
        onClose: () => finish(false)
      }
    );
  });

let sessionTemplateProvidersState: TableStateProvider<
  SessionTemplateProvidersTableProps,
  SessionTemplateProviderRow,
  TableStateProviderResult<SessionTemplateProviderRow>
> = props => ({
  isLoading: props.providers.isLoading,
  error: props.providers.error,
  hasMoreAfter: false,
  hasMoreBefore: false,
  items: props.providers.data?.items ?? [],
  loadNext: () => {},
  loadPrevious: () => {}
});

let useSessionTemplateProvidersTableHookState = (
  _: ReturnType<typeof sessionTemplateProvidersState>,
  props: SessionTemplateProvidersTableProps
): SessionTemplateProvidersTableHookState => ({
  instanceId: props.instanceId,
  sessionTemplateId: props.sessionTemplateId,
  providers: props.providers,
  listingLookup: props.listingLookup
});

let sessionTemplateProvidersTable = new DashboardTable<
  SessionTemplateProvidersTableProps,
  SessionTemplateProviderRow
>('session-template-providers', { hasPagination: false })
  .state(sessionTemplateProvidersState)
  .hookState(useSessionTemplateProvidersTableHookState)
  .columns([
    {
      id: 'provider',
      isDefault: true,
      header: 'Provider',
      render: (provider, props) => {
        let listing = getProviderListing(provider, props.listingLookup);
        let providerName = getProviderDisplayName(provider, props.listingLookup);

        return (
          <Flex gap={10} style={{ alignItems: 'center' }}>
            <Avatar
              entity={{ name: providerName, photoUrl: listing?.imageUrl }}
              size={24}
              radius={6}
              noTooltip
              imageFit="contain"
            />
            <Text size="2" weight="strong">
              {providerName}
            </Text>
          </Flex>
        );
      }
    },
    {
      id: 'deployment',
      isDefault: true,
      header: 'Deployment',
      render: (provider, props) => {
        let deploymentId = provider.deployment.id;
        let deploymentName =
          provider.deployment.name ??
          (deploymentId ? (props.deploymentLookup[deploymentId] ?? null) : null);

        return deploymentName ? (
          <Text size="2">{deploymentName}</Text>
        ) : (
          <Text size="2" color="gray500">
            —
          </Text>
        );
      }
    },
    {
      id: 'config',
      isDefault: true,
      header: 'Config',
      render: provider =>
        provider.config.name || provider.config.id ? (
          <Text size="2">{provider.config.name ?? provider.config.id}</Text>
        ) : (
          <Text size="2" color="gray500">
            —
          </Text>
        )
    },
    {
      id: 'authConfig',
      isDefault: true,
      header: 'Auth Config',
      render: (provider, props) => {
        let authConfigId = provider.authConfig?.id ?? null;
        let authConfigLabel = authConfigId
          ? (props.authConfigNameLookup[authConfigId] ?? null)
          : null;

        return authConfigLabel ? (
          <Text size="2">{authConfigLabel}</Text>
        ) : (
          <Text size="2" color="gray500">
            —
          </Text>
        );
      }
    },
    {
      id: 'toolFilters',
      isDefault: true,
      header: 'Tool Filters',
      render: provider => <Text size="2">{getToolFilterSummary(provider.toolFilter)}</Text>
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: provider => <Text size="2">{provider.status}</Text>
    },
    {
      id: 'createdAt',
      isDefault: false,
      header: 'Created',
      render: provider => <RenderDate date={provider.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: provider => <RenderDate date={provider.updatedAt} />
    },
    {
      id: 'providerId',
      isDefault: false,
      header: 'Provider ID',
      render: provider => <ID id={getProviderId(provider)} />
    },
    {
      id: 'deploymentId',
      isDefault: false,
      header: 'Deployment ID',
      render: provider => <ID id={provider.deployment.id} />
    },
    {
      id: 'configId',
      isDefault: false,
      header: 'Config ID',
      render: provider => <ID id={provider.config.id} />
    },
    {
      id: 'authConfigId',
      isDefault: false,
      header: 'Auth Config ID',
      render: provider =>
        provider.authConfig?.id ? (
          <ID id={provider.authConfig.id} />
        ) : (
          <Text size="2" color="gray500">
            —
          </Text>
        )
    }
  ])
  .actions({
    edit: async (providers, state) => {
      let provider = providers[0];
      if (!provider) return;

      let resolvedProviderId = getProviderId(provider);
      showAddProviderSidePanel({
        instanceId: state.instanceId,
        sessionTemplateId: state.sessionTemplateId,
        sessionTemplateProviderId: provider.id,
        providerId: resolvedProviderId,
        hideProviderStep: true,
        initialDeploymentId: provider.deployment.id,
        initialConfigId: provider.config.id,
        initialAuthConfigId: provider.authConfig?.id ?? undefined,
        initialToolFilter: provider.toolFilter ?? null,
        title: 'Edit Provider',
        description: 'Update provider settings for this template.',
        action: 'Save Changes',
        onComplete: () => state.providers.refetch()
      });
    },
    remove: async (providers, state) => {
      let provider = providers[0];
      if (!provider) return;

      await showRemoveProviderModal({
        instanceId: state.instanceId,
        sessionTemplateId: state.sessionTemplateId,
        provider,
        displayName: getProviderDisplayName(provider, state.listingLookup),
        onComplete: () => state.providers.refetch()
      });
    },
    removeSelected: async (providers, state) => {
      if (providers.length === 0) return;

      await showBulkRemoveProvidersModal({
        instanceId: state.instanceId,
        sessionTemplateId: state.sessionTemplateId,
        sessionTemplateProviderIds: providers.map(provider => provider.id),
        onComplete: () => state.providers.refetch()
      });
    }
  })
  .rowActions([
    {
      id: 'edit',
      label: 'Edit',
      icon: <RiPencilLine />,
      action: 'edit'
    },
    {
      id: 'remove',
      label: 'Remove',
      icon: <RiDeleteBinLine />,
      action: 'remove'
    }
  ])
  .bulkActions([
    {
      id: 'remove-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      action: 'removeSelected'
    }
  ])
  .build();

export let SessionTemplateProvidersManager = ({
  instanceId,
  sessionTemplateId,
  actions
}: {
  instanceId: string;
  sessionTemplateId: string;
  actions?: ReactNode;
}) => {
  let providers = useSessionTemplateProviders(instanceId, sessionTemplateId);
  let items = providers.data?.items ?? [];
  let providerIds = useMemo(
    () =>
      Array.from(
        new Set(
          items.map(item => getProviderId(item)).filter((value): value is string => !!value)
        )
      ),
    [items]
  );

  let authConfigs = useProviderAuthConfigs(instanceId, {
    providerId: providerIds.length > 0 ? providerIds : undefined
  });
  let listings = useProviderListings(instanceId, {
    id: providerIds.length > 0 ? providerIds : undefined
  });
  let deployments = useProviderDeployments(instanceId, {
    providerId: providerIds.length > 0 ? providerIds : undefined
  });

  let authConfigNameLookup = useMemo(() => {
    let lookup: Record<string, string> = {};
    for (let item of authConfigs.data?.items ?? []) {
      lookup[item.id] =
        item.name ?? (item.isDefault ? 'Default Auth Config' : 'Unnamed Auth Config');
    }
    return lookup;
  }, [authConfigs.data?.items]);

  return renderWithLoader({ listings, deployments, authConfigs })(() => {
    let listingLookup: Record<string, { name: string; imageUrl: string }> = {};
    for (let listing of listings.data?.items ?? []) {
      let providerId = listing.provider?.id;
      if (!providerId) continue;
      listingLookup[providerId] = { name: listing.name, imageUrl: listing.imageUrl };
    }

    let deploymentLookup: Record<string, string> = {};
    for (let deployment of deployments.data?.items ?? []) {
      if (deployment.name) deploymentLookup[deployment.id] = deployment.name;
    }

    return sessionTemplateProvidersTable({
      instanceId,
      sessionTemplateId,
      providers,
      listingLookup,
      deploymentLookup,
      authConfigNameLookup,
      headerActions: actions ? () => actions : undefined,
      emptyState: () => (
        <EmptyState
          title="No providers configured"
          description="Add providers to this setup so new sessions automatically include them."
          action={{
            label: 'Add Provider',
            onClick: () =>
              showAddProviderSidePanel({
                instanceId,
                sessionTemplateId,
                onComplete: () => providers.refetch()
              })
          }}
        />
      )
    });
  });
};
