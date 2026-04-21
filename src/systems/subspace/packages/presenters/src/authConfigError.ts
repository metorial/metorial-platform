import { delay } from '@lowerdeck/delay';
import {
  db,
  type AuthConfigError,
  type AuthConfigErrorGlobal,
  type AuthConfigEvent,
  type Provider,
  type ProviderAuthConfig,
  type ProviderAuthCredentials,
  type ProviderOAuthSetup
} from '@metorial-subspace/db';

export let authConfigErrorPresenter = async (
  error: AuthConfigError & {
    group: AuthConfigErrorGlobal | null;
    authConfigEvent: AuthConfigEvent | null;
    authConfig: ProviderAuthConfig | null;
    authCredentials: ProviderAuthCredentials | null;
    oauthSetup: ProviderOAuthSetup | null;
    provider: Provider;
  }
) => {
  try {
    let i = 0;
    while (error.isProcessing || !error.group) {
      if (i++ >= 10) break;

      await delay(250);

      let refreshedError = await db.authConfigError.findUniqueOrThrow({
        where: { oid: error.oid },
        include: { group: true }
      });

      error = Object.assign(error, refreshedError);
    }
  } catch (err) {
    console.error('Error refreshing auth config error for presenter', err);
  }

  return {
    object: 'auth_config.error',

    id: error.id,
    status: error.isProcessing ? ('processing' as const) : ('processed' as const),

    type: error.type,
    code: error.code,
    message: error.message,

    data: error.payload,

    authConfigEventId: error.authConfigEvent?.id ?? null,
    authConfigId: error.authConfig?.id ?? null,
    authCredentialsId: error.authCredentials?.id ?? null,
    providerOAuthSetupId: error.oauthSetup?.id ?? null,
    providerId: error.provider.id,

    providerInvocationId: error.providerInvocationId,

    groupId: error.group?.id ?? null,
    similarErrorCount: error.group?.occurrenceCount ?? 0,

    createdAt: error.createdAt
  };
};
