import { DashboardInstanceSessionTemplatesProvidersListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList, defineAction, lifecycleStatus } from '@metorial/data-list';
import { EmptyState } from '@metorial/empty-state';
import {
  useDeleteSessionTemplateProvider,
  useProviderAuthConfigs,
  useProviderDeployments,
  useProviderListings,
  useSessionTemplateProviders
} from '@metorial/state';
import { Avatar, Flex, Text } from '@metorial/ui';
import { RiDeleteBinLine, RiPencilLine } from '@remixicon/react';
import { type ReactNode, useMemo } from 'react';
import { ToolFilterSummaryText } from '../../lib/toolFilterSummary';
import {
  type ProviderPanelSubmitInput,
  showAddProviderPanelFlow
} from './addProviderPanelFlow';

type SessionTemplateProviderItem =
  DashboardInstanceSessionTemplatesProvidersListOutput['items'][number];

type SessionTemplateProviderRow = SessionTemplateProviderItem & {
  providerName: string;
  providerImageUrl: string | null;
  deploymentName: string | null;
  authConfigName: string | null;
};

type SessionTemplateProviderToolFilter = SessionTemplateProviderItem['toolFilter'] | null;

type SessionTemplateProvidersTableProps = {
  instanceId: string;
  sessionTemplateId: string;
};

let getProviderId = (provider: SessionTemplateProviderItem) =>
  provider.providerId ?? provider.deployment.providerId ?? provider.config.providerId;

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

let SessionTemplateProvidersList = createDataList<SessionTemplateProvidersTableProps>(
  'session-template-providers'
)
  .paginated(({ props }) =>
    useSessionTemplateProviders(props.instanceId, props.sessionTemplateId)
  )
  .enrich<SessionTemplateProviderRow>((items, { props }) => {
    let providerIds = useMemo(
      () => [...new Set(items.map(getProviderId).filter((value): value is string => !!value))],
      [items]
    );
    let instanceId = providerIds.length > 0 ? props.instanceId : null;

    let authConfigs = useProviderAuthConfigs(instanceId, {
      ownership: 'all',
      providerId: providerIds
    });
    let listings = useProviderListings(instanceId, { id: providerIds });
    let deployments = useProviderDeployments(instanceId, { providerId: providerIds });

    let rows = useMemo<SessionTemplateProviderRow[]>(() => {
      let listingByProviderId = new Map(
        (listings.data?.items ?? []).map(listing => [listing.provider.id, listing] as const)
      );
      let deploymentNameById = new Map(
        (deployments.data?.items ?? []).map(deployment => [deployment.id, deployment.name])
      );
      let authConfigNameById = new Map(
        (authConfigs.data?.items ?? []).map(
          authConfig =>
            [
              authConfig.id,
              authConfig.name ??
                (authConfig.isDefault ? 'Default Auth Config' : 'Unnamed Auth Config')
            ] as const
        )
      );

      return items.map(item => {
        let providerId = getProviderId(item);
        let listing = providerId ? listingByProviderId.get(providerId) : undefined;
        let authConfigId = item.authConfig?.id;

        return {
          ...item,
          providerName: listing?.name ?? providerId ?? 'Provider',
          providerImageUrl: listing?.imageUrl ?? null,
          deploymentName:
            item.deployment.name ?? deploymentNameById.get(item.deployment.id) ?? null,
          authConfigName: authConfigId ? (authConfigNameById.get(authConfigId) ?? null) : null
        };
      });
    }, [items, listings.data?.items, deployments.data?.items, authConfigs.data?.items]);

    return {
      items: rows,
      isLoading:
        providerIds.length > 0 &&
        (listings.isLoading || deployments.isLoading || authConfigs.isLoading),
      error: listings.error ?? deployments.error ?? authConfigs.error
    };
  })
  .columns([
    col.custom({
      id: 'provider',
      header: 'Provider',
      render: row => (
        <Flex gap={10} align="center">
          <Avatar
            entity={{ name: row.providerName, photoUrl: row.providerImageUrl ?? undefined }}
            size={24}
            radius={6}
            noTooltip
            imageFit="contain"
          />
          <Text size="2" weight="strong">
            {row.providerName}
          </Text>
        </Flex>
      )
    }),
    col.text({ id: 'deployment', header: 'Deployment', get: row => row.deploymentName }),
    col.text({
      id: 'config',
      header: 'Config',
      get: row => row.config.name ?? row.config.id
    }),
    col.text({ id: 'authConfig', header: 'Auth Config', get: row => row.authConfigName }),
    col.custom({
      id: 'toolFilters',
      header: 'Tool Filters',
      render: (row, props) => (
        <ToolFilterSummaryText
          instanceId={props.instanceId}
          providerId={getProviderId(row)}
          toolFilter={row.toolFilter}
        />
      )
    }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.createdAt(),
    col.updatedAt(),
    col.refId('providerId', row => getProviderId(row), { header: 'Provider ID' }),
    col.refId('deploymentId', row => row.deployment.id, { header: 'Deployment ID' }),
    col.refId('configId', row => row.config.id, { header: 'Config ID' }),
    col.refId('authConfigId', row => row.authConfig?.id, { header: 'Auth Config ID' })
  ])
  .itemActions([
    defineAction({
      id: 'edit',
      label: 'Edit',
      icon: <RiPencilLine />,
      useRun:
        ({ props }) =>
        async row => {
          showAddProviderSidePanel({
            instanceId: props.instanceId,
            sessionTemplateId: props.sessionTemplateId,
            sessionTemplateProviderId: row.id,
            providerId: getProviderId(row),
            hideProviderStep: true,
            initialDeploymentId: row.deployment.id,
            initialConfigId: row.config.id,
            initialAuthConfigId: row.authConfig?.id ?? undefined,
            initialToolFilter: row.toolFilter ?? null,
            title: 'Edit Provider',
            description: 'Update provider settings for this template.',
            action: 'Save Changes',
            onComplete: () => {}
          });
        }
    }),
    defineAction({
      id: 'remove',
      label: 'Remove',
      icon: <RiDeleteBinLine />,
      destructive: true,
      bulk: { label: 'Delete' },
      confirm: {
        title: 'Remove Provider',
        confirmText: 'Remove',
        description: rows =>
          rows.length > 1
            ? `Remove ${rows.length} selected providers from this template?`
            : `Are you sure you want to remove ${rows[0]?.providerName} from this template? Sessions created from this template will no longer include this provider.`
      },
      useRun: ({ props }) => {
        let deleteMutation = useDeleteSessionTemplateProvider();

        return async row => {
          let [, error] = await deleteMutation.mutate({
            instanceId: props.instanceId,
            sessionTemplateId: props.sessionTemplateId,
            sessionTemplateProviderId: row.id
          });
          if (error) throw error;
        };
      }
    })
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
}) => (
  <SessionTemplateProvidersList
    instanceId={instanceId}
    sessionTemplateId={sessionTemplateId}
    listVariant="embedded"
    headerActions={actions ? () => actions : undefined}
    emptyState={{
      initial: () => (
        <EmptyState
          title="No providers configured"
          description="Add providers to this setup so new sessions automatically include them."
          action={{
            label: 'Add Provider',
            onClick: () =>
              showAddProviderSidePanel({
                instanceId,
                sessionTemplateId,
                onComplete: () => {}
              })
          }}
        />
      )
    }}
  />
);
