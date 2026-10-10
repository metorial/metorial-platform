import { delay } from '@lowerdeck/delay';
import { badRequestError, notFoundError, ServiceError, timeoutError } from '@lowerdeck/error';
import { createLock, LockAcquisitionError } from '@lowerdeck/lock';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import type {
  Secret,
  SlateAuthConfig,
  SlateAuthMethod,
  SlateInstance,
  SlateOAuthCredentials,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { ID, snowflake } from '../id';
import { extractExpiresAt } from '../lib/extractExpiresAt';
import { type SharedOAuthIdentity, sharedOAuthRefreshLockKey } from '../lib/sharedOAuthTokens';
import { matcherSetFingerprint } from '../lib/triggerRoutingMatcherSerialize';
import { triggerRoutingMatcherResyncQueue } from '../queues/trigger/routingMatcherResync';
import { type SecretSlateAuthConfig, secretService } from './secret';
import { syncSharedOAuthTokens } from './sharedOAuthTokenSync';
import { slateErrorService } from './slateError';
import { slateInvocationService } from './slateInvocation';

let include = { secret: true, authMethod: true };

type AuthConfigWithSecret = SlateAuthConfig & { secret: Secret; authMethod: SlateAuthMethod };

let Sentry = getSentry();

let refreshLock = createLock({
  name: 'shub/auth/refresh/lock',
  redisUrl: env.service.REDIS_URL
});

// Configs stay linked to the auth method version they were created with, so
// read the flag from the slate's current version.
let syncsTokensAcrossConnections = async (authConfig: AuthConfigWithSecret) => {
  let slate = await db.slate.findUnique({
    where: { oid: authConfig.slateOid },
    select: { currentVersion: { select: { specificationOid: true } } }
  });
  let specificationOid = slate?.currentVersion?.specificationOid;
  let currentMethods = specificationOid
    ? await db.slateSpecificationAuthMethod.findMany({
        where: { specificationOid },
        select: { authMethod: { select: { key: true, spec: true } } }
      })
    : [];
  let current = currentMethods.find(m => m.authMethod.key === authConfig.authMethod.key);
  let spec = (current?.authMethod.spec ?? authConfig.authMethod.spec) as
    | { syncTokensAcrossConnections?: boolean }
    | undefined;
  return spec?.syncTokensAcrossConnections === true;
};

type OAuthCredentialsWithSecret = SlateOAuthCredentials & { secret: Secret };

// Non-OAuth methods (for example client-credentials bot tokens) refresh from their
// stored input, so they need no OAuth app credentials. Unlike the sync flag above, this
// reads the config's own method spec: refreshAuthConfig invokes that spec's version.
let refreshesFromInput = (authConfig: AuthConfigWithSecret) =>
  authConfig.type === 'manual' &&
  authConfig.authMethod.type !== 'oauth' &&
  authConfig.authMethod.spec.capabilities.handleTokenRefresh?.enabled === true;

let isExpiring = (tokenExpiresAt: Date | null, minExpirationBuffer: number) =>
  !!tokenExpiresAt && tokenExpiresAt.getTime() < Date.now() + minExpirationBuffer;

let throwStoredAuthConfigError = (d: { errorCode: string; errorMessage?: string | null }) => {
  throw new ServiceError(
    badRequestError({
      code: 'invalid_provider_authentication_configuration',
      message: `Provider authentication configuration has an error: ${
        d.errorMessage ?? d.errorCode
      }`
    })
  );
};

class slateAuthHandlerServiceImpl {
  async getSlateInstanceAuth(d: {
    tenant: Tenant;
    slateInstance?: SlateInstance;
    authConfigId: string;
    minExpirationBuffer: number;
  }) {
    let authConfig = await db.slateAuthConfig.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.authConfigId
      },
      include
    });
    if (!authConfig) throw new ServiceError(notFoundError('slate.auth_config'));
    if (
      authConfig.instanceOid &&
      d.slateInstance &&
      authConfig.instanceOid !== d.slateInstance.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'This authentication configuration is not valid for the selected provider.'
        })
      );
    }

    let i = 0;
    while (authConfig.isProcessing) {
      await delay(1000);

      authConfig = await db.slateAuthConfig.findFirstOrThrow({
        where: { oid: authConfig.oid },
        include
      });
      if (i++ > 30) {
        throw new ServiceError(
          badRequestError({
            code: 'timeout',
            message: 'Timed out waiting for authentication configuration to be ready.'
          })
        );
      }
    }

    if (authConfig.errorCode) {
      throwStoredAuthConfigError({
        errorCode: authConfig.errorCode,
        errorMessage: authConfig.errorMessage
      });
    }

    if (d.slateInstance) {
      let authConfigOid = authConfig.oid;
      db.slateAuthConfigUsedForInstance
        .createMany({
          skipDuplicates: true,
          data: {
            oid: snowflake.nextId(),
            configOid: authConfigOid,
            instanceOid: d.slateInstance.oid
          }
        })
        .catch(err => {
          console.error('Failed to log auth config usage for instance:', err);
          Sentry.captureException(err, {
            extra: { authConfigOid, instanceOid: d.slateInstance?.oid }
          });
        });
    }

    if (isExpiring(authConfig.tokenExpiresAt, d.minExpirationBuffer)) {
      let oauthCredentials: OAuthCredentialsWithSecret | null = null;

      if (authConfig.type === 'oauth_automated') {
        if (!authConfig.oauthCredentialsOid) {
          throw new Error('WTF - oauthCredentialsOid is missing on oauth_automated config');
        }

        oauthCredentials = await db.slateOAuthCredentials.findFirstOrThrow({
          where: { oid: authConfig.oauthCredentialsOid },
          include: { secret: true }
        });
      } else if (!refreshesFromInput(authConfig)) {
        throw new ServiceError(
          badRequestError({
            code: 'authentication_expired',
            message: 'Authentication configuration has expired.'
          })
        );
      }

      let refreshed = await this.refreshUnderLock({
        tenant: d.tenant,
        slateInstance: d.slateInstance,
        minExpirationBuffer: d.minExpirationBuffer,
        authConfig,
        oauthCredentials
      });

      return {
        ...refreshed.decrypted,
        authConfig: refreshed.authConfig,
        authMethod: refreshed.authConfig.authMethod
      };
    }

    let decrypted = await this.decryptAuthConfig({
      authConfig,
      tenant: d.tenant,
      note: `auth-get cfg:${authConfig.id} inst:${d.slateInstance?.id ?? 'none'}`
    });

    return {
      ...decrypted,
      authConfig,
      authMethod: authConfig.authMethod
    };
  }

  private async decryptAuthConfig(d: {
    authConfig: AuthConfigWithSecret;
    tenant: Tenant;
    note: string;
  }) {
    return await secretService.DANGEROUSLY_decryptSecret({
      secret: d.authConfig.secret,
      purpose: 'slate_authentication_configuration',
      tenant: d.tenant,
      note: d.note
    });
  }

  private async refreshUnderLock(d: {
    tenant: Tenant;
    slateInstance?: SlateInstance;
    minExpirationBuffer: number;
    authConfig: AuthConfigWithSecret;
    oauthCredentials: OAuthCredentialsWithSecret | null;
  }) {
    let identity: SharedOAuthIdentity = {
      authConfigOid: d.authConfig.oid,
      slateOid: d.authConfig.slateOid,
      authMethodKey: d.authConfig.authMethod.key,
      clientId: d.oauthCredentials?.clientId ?? '',
      profileUid: d.authConfig.profileUid
    };
    // Token syncing between connections only applies to OAuth app installs.
    let syncsTokens = d.oauthCredentials
      ? await syncsTokensAcrossConnections(d.authConfig)
      : false;

    let reload = async () => {
      let fresh = await db.slateAuthConfig.findFirstOrThrow({
        where: { oid: d.authConfig.oid },
        include
      });
      if (fresh.errorCode) {
        throwStoredAuthConfigError({
          errorCode: fresh.errorCode,
          errorMessage: fresh.errorMessage
        });
      }
      return fresh;
    };

    let decryptFresh = (fresh: AuthConfigWithSecret) =>
      this.decryptAuthConfig({
        authConfig: fresh,
        tenant: d.tenant,
        note: `auth-refresh-locked cfg:${fresh.id} inst:${d.slateInstance?.id ?? 'none'}`
      });

    type Refreshed = { authConfig: AuthConfigWithSecret; decrypted: SecretSlateAuthConfig };
    let completed: Refreshed | undefined;
    let failure: { error: unknown } | undefined;

    try {
      await refreshLock.usingLock(
        sharedOAuthRefreshLockKey(identity, syncsTokens),
        async () => {
          try {
            let fresh = await reload();
            let decrypted = await decryptFresh(fresh);

            if (isExpiring(fresh.tokenExpiresAt, d.minExpirationBuffer)) {
              await this.refreshAuthConfig({
                tenant: d.tenant,
                slateInstance: d.slateInstance,
                authConfig: fresh,
                oauthCredentials: d.oauthCredentials,
                decrypted,
                syncSiblingsOf:
                  syncsTokens && fresh.profileUid === identity.profileUid ? identity : null
              });
            }

            completed = { authConfig: fresh, decrypted };
          } catch (error) {
            failure = { error };
          }
        },
        {
          durationMs: 30_000,
          acquisitionTimeoutMs: 20_000,
          // Default retryCount (50) would cap the wait near 10s.
          retryCount: 200
        }
      );
    } catch (err) {
      if (!(err instanceof LockAcquisitionError)) {
        if (completed || failure) {
          console.error(`OAUTH.refresh_lock.release_failed cfg:${d.authConfig.id}`, err);
        } else {
          throw err;
        }
      } else {
        let fresh = await reload();
        if (!fresh.tokenExpiresAt || fresh.tokenExpiresAt.getTime() > Date.now() + 5_000) {
          return { authConfig: fresh, decrypted: await decryptFresh(fresh) };
        }

        throw new ServiceError(
          timeoutError({
            message: 'Authentication token refresh is already in progress. Retry the request.'
          })
        );
      }
    }

    if (failure) throw failure.error;
    if (!completed) throw new Error('WTF - refresh lock finished without an outcome');
    return completed;
  }

  private async refreshAuthConfig(d: {
    tenant: Tenant;
    slateInstance?: SlateInstance;
    authConfig: AuthConfigWithSecret;
    oauthCredentials: OAuthCredentialsWithSecret | null;
    decrypted: SecretSlateAuthConfig;
    syncSiblingsOf: SharedOAuthIdentity | null;
  }) {
    let { authConfig, oauthCredentials, decrypted } = d;

    let oauthDecrypted = oauthCredentials
      ? await secretService.DANGEROUSLY_decryptSecret({
          secret: oauthCredentials.secret,
          purpose: 'slate_oauth_credentials',
          tenant: d.tenant,
          note: `oauth-rfr creds:${oauthCredentials.id} cfg:${authConfig.id}`
        })
      : null;

    let authMethod = await db.slateAuthMethod.findFirstOrThrow({
      where: { oid: authConfig.authMethodOid },
      include: {
        mostRecentSpecification: true,
        slate: true
      }
    });
    let slate = authMethod.slate;
    let version = await db.slateVersion.findFirstOrThrow({
      where: {
        slateOid: slate.oid,
        oid:
          d.slateInstance?.lockedSlateVersionOid ??
          authMethod.mostRecentSpecification.mostRecentVersionOid ??
          slate.currentVersionOid
      }
    });

    let stack = await slateInvocationService.createInvocation({
      tenant: d.tenant,
      slateVersion: version,
      participants: []
    });
    let res = await slateInvocationService.refreshOAuthToken({
      stack,
      authenticationMethodId: authMethod.key,
      input: decrypted.input ?? {},
      output: decrypted.output ?? {},
      clientId: oauthDecrypted?.clientId ?? '',
      clientSecret: oauthDecrypted?.clientSecret ?? '',
      scopes: oauthCredentials?.scopes ?? []
    });
    if (res.status === 'error') {
      // A failed OAuth refresh may have consumed its refresh token, so the config is
      // marked broken. Input-based refreshes keep durable credentials and retry next time.
      if (oauthCredentials) {
        await db.slateAuthConfig.updateMany({
          where: { oid: authConfig.oid },
          data: {
            errorCode: res.error.code,
            errorMessage: res.error.message,
            errorInvocationId: res.invocation.id
          }
        });
      }
    } else {
      await db.slateAuthConfig.updateMany({
        where: { oid: authConfig.oid },
        data: {
          errorCode: null,
          errorMessage: null,
          errorInvocationId: null
        }
      });
    }

    await db.slateAuthConfigEvent.createMany({
      data: {
        oid: snowflake.nextId(),
        id: ID.generateIdSync('slateAuthConfigEvent'),
        type:
          res.status === 'error'
            ? 'oauth_token_refresh_failed'
            : 'oauth_token_refresh_completed',
        configOid: authConfig.oid,
        invocationOid: res.invocation.oid
      }
    });
    if (res.status === 'error') {
      slateErrorService
        .recordSlateError({
          type: 'oauth_token_refresh_failed',
          errorCode: res.error.code,
          errorMessage: res.error.message,
          tenantOid: d.tenant.oid,
          slateOid: slate.oid,
          slateVersionOid: version.oid,
          slateInstanceOid: d.slateInstance?.oid,
          invocationOid: res.invocation.oid,
          authConfigOid: authConfig.oid
        })
        .catch(() => {});

      throw new ServiceError(
        badRequestError({
          code: 'oauth_token_refresh_failed',
          message: `Failed to refresh authentication token: ${res.error.message}`
        })
      );
    }

    let previousOutput = decrypted.output;

    decrypted.input = res.data.input ?? decrypted.input;
    decrypted.output = res.data.output ?? decrypted.output;

    await secretService.DANGEROUSLY_updateSecret({
      secretOid: authConfig.secretOid,
      purpose: 'slate_authentication_configuration',
      tenant: d.tenant,
      secretData: decrypted
    });

    let tokenExpiresAt = extractExpiresAt(decrypted.output ?? {});
    await db.slateAuthConfig.update({
      where: { oid: authConfig.oid },
      data: {
        tokenExpiresAt,
        routingMatchers: res.data.routingMatchers ?? undefined
      }
    });

    if (res.data.routingMatchers?.length) {
      let identifiedDifferently =
        (await matcherSetFingerprint(authConfig.routingMatchers)) !==
        (await matcherSetFingerprint(res.data.routingMatchers));

      if (identifiedDifferently) {
        await triggerRoutingMatcherResyncQueue.add({ authConfigId: authConfig.id });
      }
    }

    if (d.syncSiblingsOf) {
      await syncSharedOAuthTokens({
        source: { ...d.syncSiblingsOf, authConfigId: authConfig.id },
        previousOutput,
        newOutput: decrypted.output
      }).catch(err => {
        console.error(`OAUTH.sibling_sync.error source=${authConfig.id}`, err);
        Sentry.captureException(err, { extra: { authConfigId: authConfig.id } });
      });
    }
  }
}

export let slateAuthHandlerService = Service.create(
  'slateAuthHandlerService',
  () => new slateAuthHandlerServiceImpl()
).build();
