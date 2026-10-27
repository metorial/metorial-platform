import {
  IntegrationPreview,
  instanceProviderAuthConfigsLoader,
  useProviderSetupSessions
} from '@metorial/state';
import { Button, Callout, Flex, RenderDate, Spacer, Text } from '@metorial/ui';
import { useMemo } from 'react';
import { requiresAdminSetup, showAdminSetupLinkModal } from './adminSetupLinkModal';
import {
  getProviderDisplayName,
  type ProviderListingLookup,
  useIntegrationProviderListingLookup
} from './providerLabels';

type IntegrationPreviewProvider = IntegrationPreview['providers'][number];

let AdminSetupCallout = (p: {
  instanceId: string;
  integrationProvider: IntegrationPreviewProvider;
  listingLookup: ProviderListingLookup;
  isListingLoading: boolean;
}) => {
  let authConfigs = instanceProviderAuthConfigsLoader.use({
    instanceId: p.instanceId,
    providerId: p.integrationProvider.providerId,
    providerAuthMethodId: p.integrationProvider.authMethodId ?? undefined,
    availableForUse: true,
    availableForProviderDeploymentId: p.integrationProvider.deploymentId,
    status: 'active',
    limit: 1
  });
  let adminSetupSessionsQuery = {
    providerId: p.integrationProvider.providerId,
    providerDeploymentId: p.integrationProvider.deploymentId,
    providerAuthMethodId: p.integrationProvider.authMethodId ?? undefined,
    type: 'admin' as const,
    order: 'desc' as const,
    limit: 1
  };
  let completedAdminSetups = useProviderSetupSessions(p.instanceId, {
    ...adminSetupSessionsQuery,
    status: 'completed'
  });
  let latestPendingAdminSetups = useProviderSetupSessions(p.instanceId, {
    ...adminSetupSessionsQuery,
    status: 'pending'
  });

  if (
    p.isListingLoading ||
    !authConfigs.data ||
    !completedAdminSetups.data ||
    !latestPendingAdminSetups.data ||
    authConfigs.data.items.length > 0 ||
    completedAdminSetups.data.items.length > 0
  ) {
    return null;
  }

  let latestPendingAdminSetup = latestPendingAdminSetups.data.items[0];
  let pendingAdminSetup =
    latestPendingAdminSetup?.status === 'pending' ? latestPendingAdminSetup : undefined;

  let providerName = getProviderDisplayName(p.listingLookup, p.integrationProvider);
  let openAdminSetupLinkModal = () =>
    showAdminSetupLinkModal({
      instanceId: p.instanceId,
      integrationProvider: p.integrationProvider,
      providerName
    });

  return (
    <>
      <Callout color={pendingAdminSetup ? 'gray' : 'orange'}>
        <Flex gap={15} align="center" justify="space-between" style={{ width: '100%' }}>
          {pendingAdminSetup ? (
            <Text>
              An administrator hasn't approved {providerName} yet. An admin setup link was
              created on <RenderDate date={pendingAdminSetup.createdAt} format="date" />.
            </Text>
          ) : (
            <Text>
              {providerName} needs an administrator to approve it before anyone in their
              organization can connect.
            </Text>
          )}

          <Button style={{ flexShrink: 0 }} size="1" onClick={openAdminSetupLinkModal}>
            {pendingAdminSetup ? 'Create New Link' : 'Create Admin Setup Link'}
          </Button>
        </Flex>
      </Callout>
      <Spacer height={20} />
    </>
  );
};

export let IntegrationAdminSetupCallouts = (p: {
  instanceId: string;
  integration: IntegrationPreview;
}) => {
  let adminSetupProviders = useMemo(
    () =>
      p.integration.providers.filter(
        integrationProvider =>
          integrationProvider.status === 'active' && requiresAdminSetup(integrationProvider)
      ),
    [p.integration.providers]
  );

  let { listings, lookup } = useIntegrationProviderListingLookup(
    adminSetupProviders.length > 0 ? p.instanceId : null,
    p.integration.providers
  );

  return (
    <>
      {adminSetupProviders.map(integrationProvider => (
        <AdminSetupCallout
          key={integrationProvider.id}
          instanceId={p.instanceId}
          integrationProvider={integrationProvider}
          listingLookup={lookup}
          isListingLoading={listings.isLoading}
        />
      ))}
    </>
  );
};
