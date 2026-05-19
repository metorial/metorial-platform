import {
  badRequestError,
  forbiddenError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { useRequestContext } from '@lowerdeck/hono';
import { extractToken } from '@metorial/bearer';
import { Instance } from '@metorial/db';
import { generateSnowflakeId } from '@metorial/id';
import { AuthInfo } from '@metorial/module-access';
import { consumerIntegrationService } from '@metorial/module-consumer';
import {
  ensureMagicMcpSubspaceSession,
  magicMcpEndpointService,
  magicMcpServerService,
  magicMcpTokenService,
  resolveMagicMcpTargetByIdOrAlias,
  resolveMagicMcpTargetByIdOrAliasSafe,
  syncMagicMcpSubspaceSession
} from '@metorial/module-magic';
import {
  proxyMcpRequestToSubspace,
  type SubspaceProxyAgentClient
} from '@metorial/module-subspace';
import { Authenticator } from '@metorial/rest';
import type { Context } from 'hono';
import { authenticateAndResolveInstance } from './getSession';

type MagicMcpTargetForRouting = Awaited<ReturnType<typeof resolveMagicMcpTargetByIdOrAlias>>;
type MagicMcpTokenForRouting = Awaited<
  ReturnType<typeof magicMcpTokenService.getMagicMcpTokenBySecret>
>;
type MagicMcpSessionOwnerConsumerProfile = Parameters<
  (typeof consumerIntegrationService)['materializeMagicMcpSessionOwnership']
>[0]['consumerProfile'];

export type MagicMcpSubspaceSessionInfo = {
  type: 'magic_mcp_subspace_session';
  magicMcpTarget: MagicMcpTargetForRouting;
  subspaceSessionId: string;
  magicMcpToken: MagicMcpTokenForRouting | null;
  consumerToken: Awaited<
    ReturnType<(typeof consumerIntegrationService)['findConsumerTokenByMagicMcpToken']>
  > | null;
  consumerProfileForOwnership: MagicMcpSessionOwnerConsumerProfile | null;
  agentClient?: SubspaceProxyAgentClient | null;
};

export let getMagicMcpTokenSecretFromRequest = (request: Request, url: URL) => {
  return url.searchParams.get('key') ?? extractToken(request, url) ?? null;
};

let ensureMagicMcpTokenAccess = async (d: {
  token: MagicMcpTokenForRouting;
  magicMcpTarget: MagicMcpTargetForRouting;
}) => {
  let hasAccess = await magicMcpTokenService.checkMagicMcpTokenAccess({
    token: d.token,
    server: d.magicMcpTarget.type === 'server' ? d.magicMcpTarget.target : undefined,
    endpoint: d.magicMcpTarget.type === 'endpoint' ? d.magicMcpTarget.target : undefined
  });
  if (!hasAccess) {
    throw new ServiceError(
      forbiddenError({
        message: 'Magic MCP token does not have access to this target'
      })
    );
  }
};

let resolveMagicMcpTargetFromToken = async (d: { token: MagicMcpTokenForRouting }) => {
  if (d.token.magicMcpServer && d.token.magicMcpEndpoint) {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP token must be linked to exactly one server or endpoint'
      })
    );
  }

  let magicMcpTargetIdOrAlias = d.token.magicMcpEndpoint?.id ?? d.token.magicMcpServer?.id;
  if (!magicMcpTargetIdOrAlias) {
    return null;
  }

  return await resolveMagicMcpTargetByIdOrAlias(magicMcpTargetIdOrAlias);
};

let toApiKeyRequest = (request: Request, tokenSecret: string | null) => {
  if (!tokenSecret) return request;
  if (request.headers.get('authorization')) return request;

  let headers = new Headers(request.headers);
  headers.set('authorization', `Bearer ${tokenSecret}`);

  return new Request(request, {
    headers
  });
};

let ensureMagicMcpApiKeyAccess = async (d: {
  tokenSecret: string;
  request: Request;
  url: URL;
  authenticate: Authenticator<AuthInfo>;
  magicMcpTarget: MagicMcpTargetForRouting;
}): Promise<MagicMcpSessionOwnerConsumerProfile | null> => {
  let requestForAuth = toApiKeyRequest(d.request, d.tokenSecret);
  let { instance, auth } = await authenticateAndResolveInstance(
    requestForAuth,
    d.url,
    d.authenticate
  );

  if (instance.id !== d.magicMcpTarget.target.instance.id) {
    throw new ServiceError(
      forbiddenError({
        message: 'API key does not have access to this magic MCP target'
      })
    );
  }

  if (
    auth.type == 'machine' &&
    auth.restrictions.type == 'instance' &&
    auth.machineAccess.type == 'instance_publishable'
  ) {
    if (!auth.restrictions.consumer) {
      throw new ServiceError(
        forbiddenError({
          message: 'Consumer token is required when using a publishable API key'
        })
      );
    }

    if (d.magicMcpTarget.type === 'server') {
      await magicMcpServerService.checkConsumerReadAccess({
        server: d.magicMcpTarget.target,
        accessTags: auth.restrictions.consumer.accessTags
      });
    } else {
      await magicMcpEndpointService.checkConsumerReadAccess({
        endpoint: d.magicMcpTarget.target,
        accessTags: auth.restrictions.consumer.accessTags
      });
    }

    return auth.restrictions.consumer.consumerProfile;
  }

  return null;
};

let resolveAgentClientForConsumerToken = (d: {
  consumerToken: Awaited<
    ReturnType<(typeof consumerIntegrationService)['findConsumerTokenByMagicMcpToken']>
  >;
}): SubspaceProxyAgentClient | null => {
  let consumerAuthClient =
    d.consumerToken?.magicMcpToken.consumerAuthAttempts[0]?.consumerAuthClient;
  if (!consumerAuthClient) return null;
  let consumerClient =
    consumerAuthClient.consumerAuthClientSurfaces[0]?.consumerClient ?? null;

  return {
    name: consumerClient?.name ?? consumerAuthClient.name,
    type: 'mcp_client_oauth',
    foreignId: consumerClient?.id ?? consumerAuthClient.id,
    oauthRegistrationId: consumerAuthClient.id
  };
};

export let resolveMagicMcpSubspaceSession = async (d: {
  magicMcpTargetIdOrAlias?: string;
  instanceForTokenRouting?: Instance;
  request: Request;
  url: URL;
  authenticate: Authenticator<AuthInfo>;
  ip?: string | null;
  ua?: string | null;
}): Promise<MagicMcpSubspaceSessionInfo> => {
  let tokenSecret = getMagicMcpTokenSecretFromRequest(d.request, d.url);
  if (!tokenSecret) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Magic MCP token or API key is required',
        description:
          'Provide a magic MCP token in `key` or use a Bearer API key in Authorization.'
      })
    );
  }

  let magicMcpTarget = d.magicMcpTargetIdOrAlias
    ? await resolveMagicMcpTargetByIdOrAliasSafe(d.magicMcpTargetIdOrAlias)
    : null;

  let instance = magicMcpTarget?.target.instance ?? d.instanceForTokenRouting;

  let magicMcpToken = instance
    ? await magicMcpTokenService.getMagicMcpTokenBySecret({
        secret: tokenSecret,
        instance
      })
    : null;

  if (
    magicMcpToken &&
    (!magicMcpTarget || magicMcpToken?.magicMcpEndpointOid || magicMcpToken?.magicMcpServerOid)
  ) {
    let tokenTarget = await resolveMagicMcpTargetFromToken({ token: magicMcpToken });

    if (tokenTarget?.type == 'server' && !magicMcpTarget) {
      magicMcpTarget = tokenTarget;
    } else if (
      tokenTarget?.type == 'endpoint' &&
      (!magicMcpTarget || magicMcpTarget.type == 'server')
    ) {
      magicMcpTarget = tokenTarget;
    }
  }

  if (!magicMcpTarget) {
    throw new ServiceError(
      badRequestError({
        message:
          'A server- or endpoint-specific portal route is required unless you use a target-linked magic MCP token'
      })
    );
  }

  let consumerProfileForOwnership: MagicMcpSessionOwnerConsumerProfile | null = null;

  if (magicMcpToken) {
    await ensureMagicMcpTokenAccess({
      token: magicMcpToken,
      magicMcpTarget
    });

    await magicMcpTokenService.recordMagicMcpTokenUse({
      token: magicMcpToken,
      server: magicMcpTarget.type === 'server' ? magicMcpTarget.target : undefined,
      endpoint: magicMcpTarget.type === 'endpoint' ? magicMcpTarget.target : undefined,
      ip: d.ip,
      ua: d.ua
    });
  } else {
    consumerProfileForOwnership = await ensureMagicMcpApiKeyAccess({
      tokenSecret,
      request: d.request,
      url: d.url,
      authenticate: d.authenticate,
      magicMcpTarget
    });
  }

  let subspaceSessionId = await ensureMagicMcpSubspaceSession(magicMcpTarget);
  let consumerToken = magicMcpToken
    ? await consumerIntegrationService.findConsumerTokenByMagicMcpToken({
        magicMcpToken
      })
    : null;
  consumerProfileForOwnership = consumerToken?.consumerProfile ?? consumerProfileForOwnership;
  let agentClient = resolveAgentClientForConsumerToken({ consumerToken });

  return {
    type: 'magic_mcp_subspace_session',
    magicMcpTarget,
    subspaceSessionId,
    magicMcpToken,
    consumerToken,
    consumerProfileForOwnership,
    agentClient
  };
};

export let handleMagicMcpRequest = async (d: {
  c: Context;
  magicMcpTargetIdOrAlias?: string;
  instanceForTokenRouting?: Instance;
  authenticate: Authenticator<AuthInfo>;
}) => {
  let context = useRequestContext(d.c);
  let url = new URL(d.c.req.url);
  let request = d.c.req.raw;

  return provideExecutionContext(
    createExecutionContext({
      userAgent: context.ua ?? 'unknown',
      ip: context.ip,
      contextId: generateSnowflakeId('mreq'),
      type: 'request'
    }),
    async () => {
      let sessionInfo = await resolveMagicMcpSubspaceSession({
        magicMcpTargetIdOrAlias: d.magicMcpTargetIdOrAlias,
        instanceForTokenRouting: d.instanceForTokenRouting,
        request,
        url,
        authenticate: d.authenticate,
        ip: context.ip,
        ua: context.ua
      });

      return await proxyMcpRequestToSubspace(
        d.c,
        sessionInfo.magicMcpTarget.target.instance,
        sessionInfo.subspaceSessionId,
        {
          agentClient: sessionInfo.agentClient,
          onSubspaceSessionResolved: async ({ subspaceSessionId }) => {
            let magicMcpSession = await syncMagicMcpSubspaceSession(
              sessionInfo.magicMcpTarget,
              subspaceSessionId
            );
            if (!sessionInfo.consumerProfileForOwnership) return;

            await consumerIntegrationService.materializeMagicMcpSessionOwnership({
              consumerProfile: sessionInfo.consumerProfileForOwnership,
              magicMcpTarget: sessionInfo.magicMcpTarget,
              magicMcpSession
            });
          }
        }
      );
    }
  );
};
