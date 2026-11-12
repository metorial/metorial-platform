import { isServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import type {
  SlateAuthConfig,
  SlateAuthMethod,
  SlateInstance,
  Tenant
} from '../../../prisma/generated/client';
import { secretService } from '../../services/secret';
import { slateAuthHandlerService } from '../../services/slateInstanceAuthHandler';

let Sentry = getSentry();

let defaultRefreshBufferMs = 5 * 60 * 1000;

// A failed refresh (revoked consent, a stored auth error) falls back to the stored
// credentials so the provider's rejection reaches each job's existing failure handling.
export let resolveTriggerAuth = async (d: {
  tenant: Tenant;
  slateInstance: SlateInstance;
  authConfig: (SlateAuthConfig & { authMethod: SlateAuthMethod }) | null;
  note: string;
  minExpirationBuffer?: number;
}): Promise<{ authenticationMethodId: string; data: Record<string, any> } | null> => {
  if (!d.authConfig) return null;

  try {
    let auth = await slateAuthHandlerService.getSlateInstanceAuth({
      tenant: d.tenant,
      slateInstance: d.slateInstance,
      authConfigId: d.authConfig.id,
      minExpirationBuffer: d.minExpirationBuffer ?? defaultRefreshBufferMs
    });
    return {
      authenticationMethodId: auth.authMethod.key,
      data: auth.output ?? auth.input ?? {}
    };
  } catch (error) {
    // Service errors are the expected refusals; anything else is a fault nobody would see.
    if (isServiceError(error)) {
      console.warn(
        `TRIGGER.auth_refresh.failed cfg:${d.authConfig.id} code:${error.data.code} note:${d.note}`
      );
    } else {
      console.error(
        `TRIGGER.auth_refresh.failed cfg:${d.authConfig.id} note:${d.note}`,
        error
      );
      Sentry.captureException(error, {
        extra: { authConfigId: d.authConfig.id, note: d.note }
      });
    }

    let decrypted = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: d.authConfig.secretOid,
      purpose: 'slate_authentication_configuration',
      tenant: d.tenant,
      note: d.note
    });
    return {
      authenticationMethodId: d.authConfig.authMethod.key,
      data: decrypted.output ?? decrypted.input ?? {}
    };
  }
};
