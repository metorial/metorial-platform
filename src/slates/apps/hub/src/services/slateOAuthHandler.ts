import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  Prisma,
  SlateInstanceOAuthSetup,
  SlateInvocation
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId, ID, snowflake } from '../id';
import { extractExpiresAt } from '../lib/extractExpiresAt';
import { getInvocationErrorCode } from '../lib/invocation/error';
import { normalizeAuthorizationUrl } from '../lib/normalizeAuthorizationUrl';
import {
  type CallbackSetupLookup,
  resolveCallbackSetupId
} from '../lib/resolveCallbackSetupId';
import { processAuthQueue } from '../queues/instance/processAuth';
import { secretService } from './secret';
import { slateErrorService } from './slateError';
import { slateInvocationService } from './slateInvocation';

let callbackUrlBase = new URL(env.service.SERVICE_PUBLIC_URL);
callbackUrlBase.pathname = '/slates-hub/callback';
let callbackUrl = callbackUrlBase.toString();

let setupInclude = {
  slateVersion: true,
  authMethod: true,
  oauthCredentials: true,
  tenant: true,
  instanceConfiguration: true
} satisfies Prisma.SlateInstanceOAuthSetupInclude;

type SetupWithRelations = Prisma.SlateInstanceOAuthSetupGetPayload<{
  include: typeof setupInclude;
}>;

let invalidSetupError = () =>
  new ServiceError(
    badRequestError({
      message: 'Invalid OAuth setup ID.'
    })
  );

let setupCookieMismatchError = () =>
  new ServiceError(
    badRequestError({
      message:
        'This admin setup was started in a different browser. Open the admin setup link again in this browser.',
      code: 'setup_cookie_mismatch'
    })
  );

class slateOAuthHandlerServiceImpl {
  async startOAuthFlow(d: { setupId: string }) {
    let setup = await db.slateInstanceOAuthSetup.findUnique({
      where: { id: d.setupId },
      include: setupInclude
    });
    if (!setup || setup.status === 'completed') throw invalidSetupError();

    if (setup.isAdminSetup && setup.status === 'failed') {
      throw new ServiceError(
        badRequestError({
          message: 'This admin setup has failed. Request a new admin setup link.',
          code: 'admin_setup_failed'
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

    let urlInput = {
      stack: await this.createSetupInvocation(setup),

      authenticationMethodId: setup.authMethod.key,
      redirectUri: setup.callbackUrlOverride ?? callbackUrl,
      state: setup.id,
      input: oauthSecret.input,
      clientId: credentialsSecrets.clientId,
      clientSecret: credentialsSecrets.clientSecret,
      scopes: setup.oauthCredentials.scopes
    };

    let urlRes = setup.isAdminSetup
      ? await slateInvocationService.getAdminOAuthUrl(urlInput)
      : await slateInvocationService.getOAuthUrl(urlInput);

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
      await this.markFailed({
        setup,
        code: getInvocationErrorCode(urlRes.error),
        message: urlRes.error.message,
        invocation: urlRes.invocation
      });

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
    input: CallbackSetupLookup & {
      error: string;
      errorDescription?: string;
    };
  }) {
    let { setup, cookieMatches } = await this.findCallbackSetup(d.input);

    if (setup.isAdminSetup && !cookieMatches) throw setupCookieMismatchError();

    let storedErrorMessage = d.input.errorDescription
      ? `${d.input.error}: ${d.input.errorDescription}`
      : d.input.error;

    return await this.markFailed({ setup, code: d.input.error, message: storedErrorMessage });
  }

  async completeOAuthFlow(d: {
    input: CallbackSetupLookup & {
      code?: string;
      callbackParams: Record<string, string>;
    };
  }) {
    let { setup, cookieMatches } = await this.findCallbackSetup(d.input);

    if (setup.isAdminSetup) {
      return await this.completeAdminFlow({
        setup,
        cookieMatches,
        code: d.input.code,
        callbackParams: d.input.callbackParams
      });
    }

    let code = d.input.code;
    if (!code) {
      return await this.markFailed({ setup, code: 'missing_code', message: 'missing_code' });
    }

    let { callbackInput, oauthSecret } = await this.buildCallbackInput(
      setup,
      d.input.callbackParams
    );

    let res = await slateInvocationService.getOAuthCallback({ ...callbackInput, code });

    await db.slateInstanceOAuthSetupEvent.createMany({
      data: {
        oid: snowflake.nextId(),
        id: ID.generateIdSync('slateInstanceOAuthSetupEvent'),
        type: 'exchange_authorization_code',
        setupOid: setup.oid,
        invocationOid: res.invocation.oid
      }
    });

    if (res.status === 'error') {
      await db.slateInstanceOAuthSetupEvent.createMany({
        data: {
          oid: snowflake.nextId(),
          id: ID.generateIdSync('slateInstanceOAuthSetupEvent'),
          type: 'oauth_setup_failed',
          setupOid: setup.oid
        }
      });

      return await this.markFailed({
        setup,
        code: getInvocationErrorCode(res.error),
        message: res.error.message,
        invocation: res.invocation
      });
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
        input: res.data.input ?? oauthSecret.input,
        output: res.data.output
      }
    });

    let tokenExpiresAt = extractExpiresAt(res.data.output);

    let authConfig = await db.slateAuthConfig.create({
      data: {
        ...getId('slateAuthConfig'),
        isProcessing: true,
        type: 'oauth_automated',
        tokenExpiresAt,
        grantedScopes: res.data.scopes ?? setup.oauthCredentials.scopes,
        routingMatchers: res.data.routingMatchers,

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
      data: {
        status: 'completed',
        slateAuthConfigOid: authConfig.oid,
        errorCode: null,
        errorMessage: null
      }
    });

    return { redirectUrl: this.buildRedirect(setup, 'completed', authConfig.id) };
  }

  private async completeAdminFlow(d: {
    setup: SetupWithRelations;
    cookieMatches: boolean;
    code?: string;
    callbackParams: Record<string, string>;
  }) {
    let setup = d.setup;

    if (setup.status === 'failed') {
      return { redirectUrl: this.buildRedirect(setup, 'failed') };
    }

    // Admin callbacks have no code to exchange, so the setup cookie binds them to the flow.
    // Checked before any write so another browser can't fail the setup.
    if (!d.cookieMatches) throw setupCookieMismatchError();

    let { callbackInput } = await this.buildCallbackInput(setup, d.callbackParams);

    let res = await slateInvocationService.getAdminOAuthCallback({
      ...callbackInput,
      code: d.code
    });

    if (res.status === 'error') {
      await db.slateInstanceOAuthSetupEvent.createMany({
        data: {
          oid: snowflake.nextId(),
          id: ID.generateIdSync('slateInstanceOAuthSetupEvent'),
          type: 'oauth_setup_failed',
          setupOid: setup.oid,
          invocationOid: res.invocation.oid
        }
      });

      return await this.markFailed({
        setup,
        code: getInvocationErrorCode(res.error),
        message: res.error.message,
        invocation: res.invocation
      });
    }

    let completion = await db.slateInstanceOAuthSetup.updateMany({
      where: { oid: setup.oid, status: { notIn: ['completed', 'failed'] } },
      data: {
        status: 'completed',
        adminInstructions: res.data.instructions ?? null,
        errorCode: null,
        errorMessage: null
      }
    });
    if (!completion.count) return await this.redirectForCurrentStatus(setup);

    await db.slateInstanceOAuthSetupEvent.createMany({
      data: {
        oid: snowflake.nextId(),
        id: ID.generateIdSync('slateInstanceOAuthSetupEvent'),
        type: 'oauth_setup_completed',
        setupOid: setup.oid,
        invocationOid: res.invocation.oid
      }
    });

    return { redirectUrl: this.buildRedirect(setup, 'completed') };
  }

  private async findCallbackSetup(d: CallbackSetupLookup) {
    let setupId = resolveCallbackSetupId(d);
    if (!setupId) throw invalidSetupError();

    let setup = await db.slateInstanceOAuthSetup.findUnique({
      where: { id: setupId },
      include: setupInclude
    });

    if (!setup) {
      throw d.state
        ? new ServiceError(
            badRequestError({
              message: 'OAuth state does not match the expected value.'
            })
          )
        : invalidSetupError();
    }

    if (setup.status === 'completed') throw invalidSetupError();

    return { setup, cookieMatches: d.setupCookieIds.includes(setup.id) };
  }

  private async buildCallbackInput(
    setup: SetupWithRelations,
    callbackParams: Record<string, string>
  ) {
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

    let callbackInput = {
      stack: await this.createSetupInvocation(setup),

      state: setup.id,
      authenticationMethodId: setup.authMethod.key,
      redirectUri: setup.callbackUrlOverride ?? callbackUrl,
      input: oauthSecret.input,
      callbackParams,
      callbackState: oauthSecret.callbackState,
      clientId: credentialsSecrets.clientId,
      clientSecret: credentialsSecrets.clientSecret,
      scopes: setup.oauthCredentials.scopes
    };

    return { callbackInput, oauthSecret };
  }

  private async createSetupInvocation(setup: SetupWithRelations) {
    return await slateInvocationService.createInvocation({
      tenant: setup.tenant,
      participants: [],
      slateVersion: setup.slateVersion,
      enclaveId: setup.instanceConfiguration?.enclaveId,
      egressPolicy:
        (setup.instanceConfiguration
          ?.egressPolicy as PrismaJson.CompiledEgressNetworkAllowList | null) ?? undefined
    });
  }

  private buildRedirect(
    setup: Pick<SlateInstanceOAuthSetup, 'id' | 'redirectUrl'>,
    status: 'completed' | 'failed',
    authConfigId?: string
  ) {
    let redirectUrl = new URL(setup.redirectUrl);
    redirectUrl.searchParams.set('slate_oauth_setup_id', setup.id);
    if (authConfigId) redirectUrl.searchParams.set('slate_auth_config_id', authConfigId);
    redirectUrl.searchParams.set('slate_auth_status', status);

    return redirectUrl.toString();
  }

  private async redirectForCurrentStatus(
    setup: Pick<SlateInstanceOAuthSetup, 'id' | 'redirectUrl'>
  ) {
    let current = await db.slateInstanceOAuthSetup.findUnique({
      where: { id: setup.id },
      select: { status: true, slateAuthConfig: { select: { id: true } } }
    });

    if (current?.status === 'completed') {
      return {
        redirectUrl: this.buildRedirect(setup, 'completed', current.slateAuthConfig?.id)
      };
    }

    return { redirectUrl: this.buildRedirect(setup, 'failed') };
  }

  private async markFailed(d: {
    setup: SlateInstanceOAuthSetup;
    code: string;
    message: string;
    invocation?: SlateInvocation;
  }) {
    let failure = await db.slateInstanceOAuthSetup.updateMany({
      where: { oid: d.setup.oid, status: { not: 'completed' } },
      data: {
        status: 'failed',
        errorCode: d.code,
        errorMessage: d.message
      }
    });
    if (!failure.count) return await this.redirectForCurrentStatus(d.setup);

    if (d.invocation) {
      slateErrorService
        .recordSlateError({
          type: 'oauth_setup_failed',
          errorCode: d.code,
          errorMessage: d.message,
          tenantOid: d.setup.tenantOid,
          slateVersionOid: d.setup.slateVersionOid,
          invocationOid: d.invocation.oid,
          oauthSetupOid: d.setup.oid
        })
        .catch(() => {});
    }

    return { redirectUrl: this.buildRedirect(d.setup, 'failed') };
  }
}

export let slateOAuthHandlerService = Service.create(
  'slateOAuthHandlerService',
  () => new slateOAuthHandlerServiceImpl()
).build();
