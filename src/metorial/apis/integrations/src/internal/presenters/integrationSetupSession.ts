import type {
  Integration,
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationProvider,
  IntegrationSetupSession,
  IntegrationSetupSessionProvider,
  IntegrationSetupSessionStep,
  Provider,
  ProviderListing,
  ProviderSetupSession
} from '@metorial-subspace/db';
import { env } from '../../env';
import { getImageUrl } from './utils';

export let integrationSetupSessionUrl = (
  integrationSetupSession: Pick<IntegrationSetupSession, 'id' | 'clientSecret'>
) =>
  `${env.service.INTEGRATIONS_UI_URL}/integration-setup-session/${integrationSetupSession.id}?client_secret=${integrationSetupSession.clientSecret}`;

let integrationSetupSessionStepUrl = (d: {
  integrationSetupSession: Pick<IntegrationSetupSession, 'id' | 'clientSecret'>;
  step: Pick<IntegrationSetupSessionStep, 'id'>;
}) =>
  `${env.service.INTEGRATIONS_API_URL}/integration-setup-session/${d.integrationSetupSession.id}/${d.step.id}?client_secret=${d.integrationSetupSession.clientSecret}`;

let setupStatus = (providerSetupSession: ProviderSetupSession | null) => {
  if (!providerSetupSession) return 'pending' as const;
  if (
    providerSetupSession.status === 'pending' &&
    providerSetupSession.expiresAt <= new Date()
  )
    return 'expired' as const;
  return providerSetupSession.status;
};

type IntegrationSetupSessionStepProvider = IntegrationSetupSessionProvider & {
  integrationProvider: IntegrationProvider & {
    provider: Provider & { listing?: Pick<ProviderListing, 'id' | 'image'> | null };
  };
  providerSetupSession: ProviderSetupSession | null;
  integrationInstanceProvider: IntegrationInstanceProvider | null;
};

let integrationSetupSessionStepProviderPresenter = (
  provider: Provider & { listing?: Pick<ProviderListing, 'id' | 'image'> | null }
) => ({
  object: 'provider',

  id: provider.id,
  name: provider.name,
  description: provider.description,
  slug: provider.prettySlug ?? provider.slug,
  imageUrl: provider.listing
    ? getImageUrl({ id: provider.listing.id, image: provider.listing.image })
    : null
});

let integrationSetupSessionStepPresenter = (d: {
  integrationSetupSession: Pick<IntegrationSetupSession, 'id' | 'clientSecret'>;
  step: IntegrationSetupSessionStep & {
    integrationSetupSessionProvider: IntegrationSetupSessionStepProvider;
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
    provider: integrationSetupSessionStepProviderPresenter(
      provider.integrationProvider.provider
    ),
    providerSetupSessionId: provider.providerSetupSession?.id ?? null,
    integrationInstanceProviderId: provider.integrationInstanceProvider?.id ?? null,

    createdAt: d.step.createdAt,
    updatedAt: d.step.updatedAt
  };
};

export let integrationSetupSessionPresenter = (
  integrationSetupSession: IntegrationSetupSession & {
    integration: Integration;
    integrationInstance: IntegrationInstance;
    steps: (IntegrationSetupSessionStep & {
      integrationSetupSessionProvider: IntegrationSetupSessionStepProvider;
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
    configuration: integrationSetupSession.configuration,
    redirectUrl: integrationSetupSession.redirectUrl,

    integrationId: integrationSetupSession.integration.id,
    integrationInstanceId: integrationSetupSession.integrationInstance.id,

    steps: integrationSetupSession.steps.map(step =>
      integrationSetupSessionStepPresenter({ integrationSetupSession, step })
    ),

    createdAt: integrationSetupSession.createdAt,
    updatedAt: integrationSetupSession.updatedAt,
    expiresAt: integrationSetupSession.expiresAt
  };
};
