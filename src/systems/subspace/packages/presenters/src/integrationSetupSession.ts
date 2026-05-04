import type {
  Brand,
  Integration,
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationProvider,
  IntegrationSetupSession,
  IntegrationSetupSessionProvider,
  IntegrationSetupSessionStep,
  Provider,
  ProviderSetupSession
} from '@metorial-subspace/db';
import { env } from './env';
import { integrationInstancePresenter } from './integrationInstance';
import { providerPreviewPresenter } from './provider';

export let integrationSetupSessionUrl = (integrationSetupSession: IntegrationSetupSession) =>
  `${env.service.PUBLIC_SERVICE_URL}/integration-setup-session/${integrationSetupSession.id}?client_secret=${integrationSetupSession.clientSecret}`;

let integrationSetupSessionStepUrl = (d: {
  integrationSetupSession: IntegrationSetupSession;
  step: IntegrationSetupSessionStep;
}) =>
  `${env.service.PUBLIC_SERVICE_URL}/integration-setup-session/${d.integrationSetupSession.id}/${d.step.id}?client_secret=${d.integrationSetupSession.clientSecret}`;

let setupStatus = (providerSetupSession: ProviderSetupSession | null) => {
  if (!providerSetupSession) return 'pending' as const;
  if (
    providerSetupSession.status === 'pending' &&
    providerSetupSession.expiresAt <= new Date()
  )
    return 'expired' as const;
  return providerSetupSession.status;
};

export let integrationSetupSessionStepPresenter = (d: {
  integrationSetupSession: IntegrationSetupSession;
  step: IntegrationSetupSessionStep & {
    integrationSetupSessionProvider: IntegrationSetupSessionProvider & {
      integrationProvider: IntegrationProvider & {
        provider: Provider;
      };
      providerSetupSession: ProviderSetupSession | null;
      integrationInstanceProvider: IntegrationInstanceProvider | null;
    };
  };
}) => {
  let provider = d.step.integrationSetupSessionProvider;

  return {
    object: 'integration.setup_session.step',
    id: d.step.id,
    index: d.step.index,
    status: provider.integrationInstanceProvider
      ? ('configured' as const)
      : setupStatus(provider.providerSetupSession),
    url: integrationSetupSessionStepUrl({
      integrationSetupSession: d.integrationSetupSession,
      step: d.step
    }),
    integrationProviderId: provider.integrationProvider.id,
    provider: providerPreviewPresenter(provider.integrationProvider.provider),
    providerSetupSessionId: provider.providerSetupSession?.id ?? null,
    integrationInstanceProviderId: provider.integrationInstanceProvider?.id ?? null,
    createdAt: d.step.createdAt,
    updatedAt: d.step.updatedAt
  };
};

type IntegrationSetupSessionProviderForStep = IntegrationSetupSessionProvider & {
  integrationProvider: IntegrationProvider & {
    provider: Provider;
  };
  providerSetupSession: ProviderSetupSession | null;
  integrationInstanceProvider: IntegrationInstanceProvider | null;
};

export let integrationSetupSessionPresenter = (
  integrationSetupSession: IntegrationSetupSession & {
    integration: Integration;
    integrationInstance: Parameters<typeof integrationInstancePresenter>[0];
    brand: Brand | null;
    steps: (IntegrationSetupSessionStep & {
      integrationSetupSessionProvider: IntegrationSetupSessionProviderForStep;
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
    steps: integrationSetupSession.steps.map(step =>
      integrationSetupSessionStepPresenter({
        integrationSetupSession,
        step
      })
    ),
    createdAt: integrationSetupSession.createdAt,
    updatedAt: integrationSetupSession.updatedAt,
    expiresAt: integrationSetupSession.expiresAt
  };
};
