import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { env } from '../env';
import { getId, ID, snowflake } from '../id';
import { extractExpiresAt } from '../lib/extractExpiresAt';
import { normalizeAuthorizationUrl } from '../lib/normalizeAuthorizationUrl';
import { processAuthQueue } from '../queues/instance/processAuth';
import { secretService } from './secret';
import { slateErrorService } from './slateError';
import { slateInvocationService } from './slateInvocation';

let callbackUrlBase = new URL(env.service.SERVICE_PUBLIC_URL);
callbackUrlBase.pathname = '/slates-hub/callback';
let callbackUrl = callbackUrlBase.toString();

class slateOAuthHandlerServiceImpl {
  async startOAuthFlow(d: { setupId: string }) {
    let setup = await db.slateInstanceOAuthSetup.findUnique({
      where: { id: d.setupId },
      include: {
        slateVersion: true,
        authMethod: true,
        oauthCredentials: true,
        tenant: true,
        instanceConfiguration: true
      }
    });
    if (!setup || setup.status === 'completed') {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid OAuth setup ID.'
        })
      );
    }

    await db.slateInstanceOAuthSetup.updateMany({
      where: { oid: setup.oid, status: 'unused' },
      data: { status: 'opened' }
    });
    await db.slateInstanceOAuthSetupEvent.createMany({
      data: {
        oid: snowflake.nextId(),
        id: ID.generateIdSync('slateInstanceOAuthSetupEvent'),
        type: 'setup_link_opened',
        setupOid: setup.oid
      }
    });

    let oauthSecret = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: setup.secretOid,
      purpose: 'slate_oauth_setup',
      tenant: setup.tenant,
      note: `oauth-url setup:${setup.id}`
    });
    let credentialsSecrets = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: setup.oauthCredentials.secretOid,
      purpose: 'slate_oauth_credentials',
      tenant: setup.tenant,
      note: `oauth-url creds:${setup.oauthCredentials.id} setup:${setup.id}`
    });

    let urlRes = await slateInvocationService.getOAuthUrl({
      stack: await slateInvocationService.createInvocation({
        tenant: setup.tenant,
        participants: [],
        slateVersion: setup.slateVersion,
        enclaveId: setup.instanceConfiguration?.enclaveId,
        egressPolicy:
          (setup.instanceConfiguration
            ?.egressPolicy as PrismaJson.CompiledEgressNetworkAllowList | null) ?? undefined
      }),

      authenticationMethodId: setup.authMethod.key,
      redirectUri: setup.callbackUrlOverride ?? callbackUrl,
      state: setup.id,
      input: oauthSecret.input,
      clientId: credentialsSecrets.clientId,
      clientSecret: credentialsSecrets.clientSecret,
      scopes: setup.oauthCredentials.scopes
    });

    await db.slateInstanceOAuthSetupEvent.createMany({
      data: {
        oid: snowflake.nextId(),
        id: ID.generateIdSync('slateInstanceOAuthSetupEvent'),
        type: 'get_authorization_url',
        setupOid: setup.oid,
        invocationOid: urlRes.invocation.oid
      }
    });

    if (urlRes.status === 'error') {
      await db.slateInstanceOAuthSetup.updateMany({
        where: { oid: setup.oid },
        data: {
          status: 'failed',
          errorCode: urlRes.error.code,
          errorMessage: urlRes.error.message
        }
      });
      slateErrorService
        .recordSlateError({
          type: 'oauth_setup_failed',
          errorCode: urlRes.error.code,
          errorMessage: urlRes.error.message,
          tenantOid: setup.tenantOid,
          slateVersionOid: setup.slateVersionOid,
          invocationOid: urlRes.invocation.oid,
          oauthSetupOid: setup.oid
        })
        .catch(() => {});

      throw new ServiceError(
        badRequestError({
          message: `Unable to start OAuth flow: ${urlRes.error.message}`
        })
      );
    }

    if (urlRes.data.input || urlRes.data.callbackState) {
      await secretService.DANGEROUSLY_updateSecret({
        secretOid: setup.secretOid,
        purpose: 'slate_oauth_setup',
        tenant: setup.tenant,
        secretData: {
          input: urlRes.data.input ?? oauthSecret.input,
          callbackState: urlRes.data.callbackState
        }
      });
    }

    return {
      setupCookieValue: setup.id,
      authorizationUrl: normalizeAuthorizationUrl(urlRes.data.authorizationUrl)
    };
  }

  async reportError(d: {
    input: {
      state?: string;
      lastOAuthSetupCookieId: string;
      error: string;
      errorDescription?: string;
    };
  }) {
    let storedErrorMessage = d.input.errorDescription
      ? `${d.input.error}: ${d.input.errorDescription}`
      : d.input.error;

    let setup = await db.slateInstanceOAuthSetup.findFirst({
      where: {
        OR: [
          { id: d.input.lastOAuthSetupCookieId },
          ...(d.input.state ? [{ id: d.input.state }] : [])
        ]
      }
    });
    if (!setup || setup.status === 'completed') {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid OAuth setup ID.'
        })
      );
    }

    await db.slateInstanceOAuthSetup.updateMany({
      where: { oid: setup.oid },
      data: {
        status: 'failed',
        errorMessage: storedErrorMessage
      }
    });

    let redirectUrl = new URL(setup.redirectUrl);
    redirectUrl.searchParams.set('slate_oauth_setup_id', setup.id);
    redirectUrl.searchParams.set('slate_auth_status', 'failed');

    return {
      redirectUrl: redirectUrl.toString()
    };
  }

  async completeOAuthFlow(d: {
    input: {
      code: string;
      state?: string;
      lastOAuthSetupCookieId: string;
      callbackParams: Record<string, string>;
    };
  }) {
    let setups = await db.slateInstanceOAuthSetup.findMany({
      where: {
        OR: [
          { id: d.input.lastOAuthSetupCookieId },
          ...(d.input.state ? [{ id: d.input.state }] : [])
        ]
      },
      include: {
        slateVersion: true,
        authMethod: true,
        oauthCredentials: true,
        tenant: true,
        instanceConfiguration: true
      }
    });
    let setup = setups.find(s => s.id === d.input.state) ?? setups[0];
    if (!setup || setup.status === 'completed') {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid OAuth setup ID.'
        })
      );
    }

    if (d.input.state && d.input.state !== setup.id) {
      throw new ServiceError(
        badRequestError({
          message: 'OAuth state does not match the expected value.'
        })
      );
    }

    let oauthSecret = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: setup.secretOid,
      purpose: 'slate_oauth_setup',
      tenant: setup.tenant,
      note: `oauth-cb setup:${setup.id}`
    });
    let credentialsSecrets = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: setup.oauthCredentials.secretOid,
      purpose: 'slate_oauth_credentials',
      tenant: setup.tenant,
      note: `oauth-cb creds:${setup.oauthCredentials.id} setup:${setup.id}`
    });

    let authRes = await slateInvocationService.getOAuthCallback({
      stack: await slateInvocationService.createInvocation({
        tenant: setup.tenant,
        participants: [],
        slateVersion: setup.slateVersion,
        enclaveId: setup.instanceConfiguration?.enclaveId,
        egressPolicy:
          (setup.instanceConfiguration
            ?.egressPolicy as PrismaJson.CompiledEgressNetworkAllowList | null) ?? undefined
      }),

      code: d.input.code,
      state: setup.id,
      authenticationMethodId: setup.authMethod.key,
      redirectUri: setup.callbackUrlOverride ?? callbackUrl,
      input: oauthSecret.input,
      callbackParams: d.input.callbackParams,
      callbackState: oauthSecret.callbackState,
      clientId: credentialsSecrets.clientId,
      clientSecret: credentialsSecrets.clientSecret,
      scopes: setup.oauthCredentials.scopes
    });

    await db.slateInstanceOAuthSetupEvent.createMany({
      data: {
        oid: snowflake.nextId(),
        id: ID.generateIdSync('slateInstanceOAuthSetupEvent'),
        type: 'exchange_authorization_code',
        setupOid: setup.oid,
        invocationOid: authRes.invocation.oid
      }
    });

    if (authRes.status === 'error') {
      await db.slateInstanceOAuthSetupEvent.createMany({
        data: {
          oid: snowflake.nextId(),
          id: ID.generateIdSync('slateInstanceOAuthSetupEvent'),
          type: 'oauth_setup_failed',
          setupOid: setup.oid
        }
      });

      await db.slateInstanceOAuthSetup.updateMany({
        where: { oid: setup.oid },
        data: {
          status: 'failed',
          errorCode: authRes.error.code,
          errorMessage: authRes.error.message
        }
      });
      slateErrorService
        .recordSlateError({
          type: 'oauth_setup_failed',
          errorCode: authRes.error.code,
          errorMessage: authRes.error.message,
          tenantOid: setup.tenantOid,
          slateVersionOid: setup.slateVersionOid,
          invocationOid: authRes.invocation.oid,
          oauthSetupOid: setup.oid
        })
        .catch(() => {});

      let redirectUrl = new URL(setup.redirectUrl);
      redirectUrl.searchParams.set('slate_oauth_setup_id', setup.id);
      redirectUrl.searchParams.set('slate_auth_status', 'failed');

      return {
        redirectUrl: redirectUrl.toString()
      };
    }

    await db.slateInstanceOAuthSetupEvent.createMany({
      data: [
        {
          oid: snowflake.nextId(),
          id: ID.generateIdSync('slateInstanceOAuthSetupEvent'),
          type: 'access_token_received',
          setupOid: setup.oid
        },
        {
          oid: snowflake.nextId(),
          id: ID.generateIdSync('slateInstanceOAuthSetupEvent'),
          type: 'oauth_setup_completed',
          setupOid: setup.oid
        }
      ]
    });

    let authConfigSecret = await secretService.createSecret({
      tenant: setup.tenant,
      purpose: 'slate_authentication_configuration',
      secretData: {
        input: authRes.data.input ?? oauthSecret.input,
        output: authRes.data.output
      }
    });

    let tokenExpiresAt = extractExpiresAt(authRes.data.output);

    let authConfig = await db.slateAuthConfig.create({
      data: {
        ...getId('slateAuthConfig'),
        isProcessing: true,
        type: 'oauth_automated',
        tokenExpiresAt,
        grantedScopes: authRes.data.scopes ?? setup.oauthCredentials.scopes,
        routingMatchers: authRes.data.routingMatchers,

        tenantOid: setup.tenantOid,
        secretOid: authConfigSecret.oid,
        instanceOid: setup.slateInstanceOid,
        authMethodOid: setup.authMethod.oid,
        slateOid: setup.slateVersion.slateOid,
        oauthCredentialsOid: setup.oauthCredentialsOid
      }
    });

    await processAuthQueue.add({
      configId: authConfig.id
    });

    await db.slateInstanceOAuthSetup.updateMany({
      where: { oid: setup.oid },
      data: { status: 'completed', slateAuthConfigOid: authConfig.oid }
    });

    let redirectUrl = new URL(setup.redirectUrl);
    redirectUrl.searchParams.set('slate_oauth_setup_id', setup.id);
    redirectUrl.searchParams.set('slate_auth_config_id', authConfig.id);
    redirectUrl.searchParams.set('slate_auth_status', 'completed');

    return {
      redirectUrl: redirectUrl.toString()
    };
  }
}

export let slateOAuthHandlerService = Service.create(
  'slateOAuthHandlerService',
  () => new slateOAuthHandlerServiceImpl()
).build();
