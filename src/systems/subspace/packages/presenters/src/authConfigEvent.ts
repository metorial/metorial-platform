import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthConfigEvent,
  ProviderAuthCredentials,
  ProviderOAuthSetup
} from '@metorial-subspace/db';
import { normalizeStoredProviderInvocationId } from '@metorial-subspace/provider-utils';

let normalizeAuthConfigEventSourceType = (sourceType: string) => {
  if (
    sourceType === 'slates.auth_config_event' ||
    sourceType === 'shuttle.server_auth_config_event'
  ) {
    return 'auth_config_event';
  }

  if (
    sourceType === 'slates.oauth_setup_event' ||
    sourceType === 'slates.oauth_setup' ||
    sourceType === 'shuttle.server_oauth_setup'
  ) {
    return 'oauth_setup_event';
  }

  return 'unknown';
};

let normalizeAuthConfigEventStatus = (d: {
  status: ProviderAuthConfigEvent['status'];
  type: string;
  authConfigErrorId: string | null;
}) => {
  if (d.status === 'failed') return 'error' as const;
  if (d.authConfigErrorId) return 'error' as const;
  if (d.type.endsWith('_failed') || d.type.includes('error')) return 'error' as const;
  return 'success' as const;
};

export let authConfigEventPresenter = async (
  event: ProviderAuthConfigEvent & {
    authConfig: ProviderAuthConfig | null;
    authCredentials: ProviderAuthCredentials | null;
    oauthSetup: ProviderOAuthSetup | null;
    provider: Provider;
    errors: { id: string }[];
  }
) => {
  let normalizedSourceType = normalizeAuthConfigEventSourceType(event.sourceType);
  let authConfigErrorId = event.errors[0]?.id ?? null;
  let status = normalizeAuthConfigEventStatus({
    status: event.status,
    type: event.type,
    authConfigErrorId
  });

  return {
    object: 'auth_config.event',

    id: event.id,
    type: event.type,
    status,
    sourceType: normalizedSourceType,
    sourceId: event.sourceId,

    authConfigId: event.authConfig?.id ?? null,
    authCredentialsId: event.authCredentials?.id ?? null,
    providerOAuthSetupId: event.oauthSetup?.id ?? null,
    providerId: event.provider.id,
    authConfigErrorId,

    providerInvocationId: normalizeStoredProviderInvocationId({
      sourceType: event.sourceType,
      providerInvocationId: event.providerInvocationId
    }),

    data: event.payload,

    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
};
