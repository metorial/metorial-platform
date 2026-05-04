import type {
  Brand,
  Integration,
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationProvider,
  IntegrationSetupSession,
  IntegrationSetupSessionProvider,
  Provider,
  ProviderSetupSession
} from '@metorial-subspace/db';
import { env } from './env';
import { integrationInstancePresenter } from './integrationInstance';
import { providerPreviewPresenter } from './provider';

let providerSetupSessionUrl = (providerSetupSession: ProviderSetupSession | null) =>
  providerSetupSession
    ? `${env.service.PUBLIC_SERVICE_URL}/setup-session/${providerSetupSession.id}?client_secret=${providerSetupSession.clientSecret}`
    : null;

let integrationSetupSessionUrl = (integrationSetupSession: IntegrationSetupSession) =>
  `${env.service.PUBLIC_SERVICE_URL}/integration-setup-session/${integrationSetupSession.id}?client_secret=${integrationSetupSession.clientSecret}`;

let setupStatus = (providerSetupSession: ProviderSetupSession | null) => {
  if (!providerSetupSession) return 'pending' as const;
  if (
    providerSetupSession.status === 'pending' &&
    providerSetupSession.expiresAt <= new Date()
  )
    return 'expired' as const;
  return providerSetupSession.status;
};

export let integrationSetupSessionProviderPresenter = (
  provider: IntegrationSetupSessionProvider & {
    integrationProvider: IntegrationProvider & {
      provider: Provider;
    };
    providerSetupSession: ProviderSetupSession | null;
    integrationInstanceProvider: IntegrationInstanceProvider | null;
  }
) => ({
  object: 'integration.setup_session.provider',
  id: provider.id,
  status: provider.integrationInstanceProvider
    ? ('configured' as const)
    : setupStatus(provider.providerSetupSession),
  integrationProviderId: provider.integrationProvider.id,
  provider: providerPreviewPresenter(provider.integrationProvider.provider),
  providerSetupSessionId: provider.providerSetupSession?.id ?? null,
  providerSetupSessionUrl: providerSetupSessionUrl(provider.providerSetupSession),
  integrationInstanceProviderId: provider.integrationInstanceProvider?.id ?? null,
  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});

export let integrationSetupSessionPresenter = (
  integrationSetupSession: IntegrationSetupSession & {
    integration: Integration;
    integrationInstance: Parameters<typeof integrationInstancePresenter>[0];
    brand: Brand | null;
    providers: (IntegrationSetupSessionProvider & {
      integrationProvider: IntegrationProvider & {
        provider: Provider;
      };
      providerSetupSession: ProviderSetupSession | null;
      integrationInstanceProvider: IntegrationInstanceProvider | null;
    })[];
  }
) => {
  let status =
    integrationSetupSession.status === 'pending' &&
    integrationSetupSession.expiresAt <= new Date()
      ? ('expired' as const)
      : integrationSetupSession.status;

  return {
    object: 'integration.setup_session',
    id: integrationSetupSession.id,
    status,
    url: integrationSetupSessionUrl(integrationSetupSession),
    name: integrationSetupSession.name,
    description: integrationSetupSession.description,
    metadata: integrationSetupSession.metadata,
    privateMetadata: integrationSetupSession.privateMetadata,
    configuration: integrationSetupSession.configuration,
    redirectUrl: integrationSetupSession.redirectUrl,
    integrationId: integrationSetupSession.integration.id,
    integrationInstanceId: integrationSetupSession.integrationInstance.id,
    integrationInstance: integrationInstancePresenter(
      integrationSetupSession.integrationInstance
    ),
    providers: integrationSetupSession.providers.map(integrationSetupSessionProviderPresenter),
    createdAt: integrationSetupSession.createdAt,
    updatedAt: integrationSetupSession.updatedAt,
    expiresAt: integrationSetupSession.expiresAt
  };
};
