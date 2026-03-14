import {
  DashboardInstanceSessionTemplatesProvidersListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCreateSessionTemplateProvider,
  useDeleteSessionTemplateProvider,
  useInstanceProviderAuthConfigs,
  useProviderDeployments,
  useProviderListings,
  useSessionTemplateProviders
} from '@metorial/state';
import {
  Avatar,
  Button,
  Dialog,
  Flex,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../../../components/emptyState';
import {
  ProviderConfigurationSelectionModalContent,
  showProviderConfigurationSelectionModal
} from '../providers/providerConfigurationSelectionModal';

type SessionTemplateProviderRow =
  DashboardInstanceSessionTemplatesProvidersListOutput['items'][number];

let AddProviderModalContent = ({
  instanceId,
  sessionTemplateId,
  onComplete
}: {
  instanceId: string;
  sessionTemplateId: string;
  onComplete: () => void;
}) => {
  let createMutation = useCreateSessionTemplateProvider();

  return (
    <ProviderConfigurationSelectionModalContent
      instanceId={instanceId}
      saving={createMutation.isPending}
      mutationError={<createMutation.RenderError />}
      submitLabel="Add Provider"
      includeToolFilters
      onSubmit={async values => {
        let [result, error] = await createMutation.mutate({
          instanceId,
          sessionTemplateId,
          providerDeploymentId: values.selectedDeploymentId,
          ...(values.selectedConfiguration.kind === 'config'
            ? {
                providerConfigId: values.selectedConfiguration.id
              }
            : {}),
          ...(values.selectedConfiguration.kind === 'vault'
            ? {
                providerConfigVaultId: values.selectedConfiguration.id
              }
            : {}),
          ...(values.selectedAuthConfigId
            ? {
                providerAuthConfigId: values.selectedAuthConfigId
              }
            : {}),
          ...(values.toolFilterMode === 'select' && values.selectedToolKeys.length > 0
            ? { toolFilters: { toolKeys: values.selectedToolKeys } }
            : {})
        });

        if (result && !error) {
          onComplete();
          return { success: true };
        }

        return { error };
      }}
    />
  );
};

export let showAddProviderModal = (p: {
  instanceId: string;
  sessionTemplateId: string;
  onComplete: () => void;
}) =>
  showProviderConfigurationSelectionModal({
    title: 'Add Provider',
    description: 'Select a provider to add to this template.',
    render: close => (
      <AddProviderModalContent
        instanceId={p.instanceId}
        sessionTemplateId={p.sessionTemplateId}
        onComplete={() => {
          p.onComplete();
          close();
        }}
      />
    )
  });

let showRemoveProviderModal = (p: {
  instanceId: string;
  sessionTemplateId: string;
  provider: SessionTemplateProviderRow;
  displayName: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let [loading, setLoading] = useState(false);
    let deleteMutation = useDeleteSessionTemplateProvider();

    return (
      <Dialog.Wrapper {...dialogProps} width={450}>
        <Dialog.Title>Remove Provider</Dialog.Title>
        <Dialog.Description>
          Are you sure you want to remove <strong>{p.displayName}</strong> from this template?
          Sessions created from this template will no longer include this provider.
        </Dialog.Description>

        <Spacer size={20} />

        <Dialog.Actions>
          <Button variant="outline" onClick={close} disabled={loading}>
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
  });

export let SessionTemplateProvidersManager = ({
  instanceId,
  sessionTemplateId
}: {
  instanceId: string;
  sessionTemplateId: string;
}) => {
  let providers = useSessionTemplateProviders(instanceId, sessionTemplateId);
  let listings = useProviderListings({});
  let deployments = useProviderDeployments(instanceId);
  let items = providers.data?.items ?? [];
  let authConfigProviderIds = useMemo(
    () =>
      Array.from(
        new Set(items.map(item => item.providerId ?? null).filter((v): v is string => !!v))
      ),
    [items]
  );
  let authConfigs = useInstanceProviderAuthConfigs(instanceId, {
    providerId: authConfigProviderIds.length > 0 ? authConfigProviderIds : undefined
  });

  let authConfigNameLookup = useMemo(() => {
    let lookup: Record<string, string> = {};
    for (let item of authConfigs.data?.items ?? []) {
      lookup[item.id] =
        item.name ?? (item.isDefault ? 'Default Auth Config' : 'Unnamed Auth Config');
    }
    return lookup;
  }, [authConfigs.data?.items]);

  return renderWithLoader({ providers, listings, deployments })(() => {
    let listingLookup: Record<string, { name: string; imageUrl: string }> = {};
    for (let l of listings.data?.items ?? []) {
      let providerId = l.provider?.id;
      if (!providerId) continue;
      listingLookup[providerId] = { name: l.name, imageUrl: l.imageUrl };
    }

    let deploymentLookup: Record<string, string> = {};
    for (let d of deployments.data?.items ?? []) {
      if (d.name) deploymentLookup[d.id] = d.name;
    }

    if (!providers.data || providers.data.items.length === 0) {
      return (
        <EmptyState
          title="No providers configured"
          description="Add providers to this template so sessions created from it will automatically include them."
          action={{
            label: 'Add Provider',
            onClick: () =>
              showAddProviderModal({
                instanceId,
                sessionTemplateId,
                onComplete: () => providers.refetch()
              })
          }}
        />
      );
    }

    return (
      <Table
        headers={['Provider', 'Deployment', 'Config', 'Auth Config', '']}
        data={providers.data.items.map(provider => {
          let providerId = provider.providerId;
          let listing = providerId ? listingLookup[providerId] : undefined;
          let providerName = listing?.name ?? providerId;
          let deploymentId = provider.deployment.id;
          let deploymentName =
            provider.deployment.name ??
            (deploymentId ? (deploymentLookup[deploymentId] ?? null) : null);
          let configName = provider.config.name ?? null;
          let configId = provider.config.id;
          let authConfigId = provider.authConfig?.id ?? null;
          let authConfigLabel = authConfigId
            ? (authConfigNameLookup[authConfigId] ?? null)
            : null;

          return {
            data: [
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
              </Flex>,

              deploymentName ? (
                <Text size="2">{deploymentName}</Text>
              ) : (
                <Text size="2" color="gray500">
                  —
                </Text>
              ),

              configName || configId ? (
                <Text size="2">{configName ?? configId}</Text>
              ) : (
                <Text size="2" color="gray500">
                  —
                </Text>
              ),

              authConfigLabel ? (
                <Text size="2">{authConfigLabel}</Text>
              ) : (
                <Text size="2" color="gray500">
                  —
                </Text>
              ),

              <Button
                size="1"
                variant="outline"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  showRemoveProviderModal({
                    instanceId,
                    sessionTemplateId,
                    provider,
                    displayName: providerName,
                    onComplete: () => providers.refetch()
                  });
                }}
              >
                Remove
              </Button>
            ]
          };
        })}
      />
    );
  });
};
