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
import {
  ensureMagicMcpSubspaceSession,
  magicMcpEndpointService,
  magicMcpServerService,
  MagicMcpSubspaceMapping,
  magicMcpTokenService,
  resolveMagicMcpTargetByIdOrAlias
} from '@metorial/module-magic';
import { proxyMcpRequestToSubspace } from '@metorial/module-subspace';
import { Authenticator } from '@metorial/rest';
import type { Context } from 'hono';
import { authenticateAndResolveInstance } from './getSession';

type MagicMcpTargetForRouting = Awaited<ReturnType<typeof resolveMagicMcpTargetByIdOrAlias>>;

export type MagicMcpSubspaceSessionInfo = {
  type: 'magic_mcp_subspace_session';
  magicMcpTarget: MagicMcpTargetForRouting;
  subspaceSessionMapping: MagicMcpSubspaceMapping;
};

export let getMagicMcpTokenSecretFromRequest = (request: Request, url: URL) => {
  return url.searchParams.get('key') ?? extractToken(request, url) ?? null;
};

let ensureMagicMcpTokenAccess = async (d: {
  tokenSecret: string;
  magicMcpTarget: MagicMcpTargetForRouting;
}) => {
  let token = await magicMcpTokenService.getMagicMcpTokenBySecret({
    secret: d.tokenSecret,
    instance: d.magicMcpTarget.target.instance
  });

  let hasAccess = await magicMcpTokenService.checkMagicMcpTokenAccess({
    token,
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

let resolveMagicMcpTargetFromToken = async (d: {
  tokenSecret: string;
  instance: Instance;
}) => {
  let token = await magicMcpTokenService.getMagicMcpTokenBySecret({
    secret: d.tokenSecret,
    instance: d.instance
  });

  if (token.magicMcpServer && token.magicMcpEndpoint) {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP token must be linked to exactly one server or endpoint'
      })
    );
  }

  let magicMcpTargetIdOrAlias = token.magicMcpEndpoint?.id ?? token.magicMcpServer?.id;
  if (!magicMcpTargetIdOrAlias) {
    throw new ServiceError(
      badRequestError({
        message:
          'This portal route requires a magic MCP token linked to exactly one server or endpoint'
      })
    );
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
}) => {
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
  }
};

export let resolveMagicMcpSubspaceSession = async (d: {
  magicMcpTargetIdOrAlias?: string;
  instanceForTokenRouting?: Instance;
  request: Request;
  url: URL;
  authenticate: Authenticator<AuthInfo>;
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

  let magicMcpTarget =
    d.magicMcpTargetIdOrAlias != null
      ? await resolveMagicMcpTargetByIdOrAlias(d.magicMcpTargetIdOrAlias)
      : tokenSecret.startsWith('metorial_mk_') && d.instanceForTokenRouting
        ? await resolveMagicMcpTargetFromToken({
            tokenSecret,
            instance: d.instanceForTokenRouting
          })
        : null;

  if (!magicMcpTarget) {
    throw new ServiceError(
      badRequestError({
        message:
          'A server- or endpoint-specific portal route is required unless you use a target-linked magic MCP token'
      })
    );
  }

  if (tokenSecret.startsWith('metorial_mk_')) {
    await ensureMagicMcpTokenAccess({
      tokenSecret,
      magicMcpTarget
    });
  } else {
    await ensureMagicMcpApiKeyAccess({
      tokenSecret,
      request: d.request,
      url: d.url,
      authenticate: d.authenticate,
      magicMcpTarget
    });
  }

  let subspaceSessionMapping = await ensureMagicMcpSubspaceSession(magicMcpTarget);

  return {
    type: 'magic_mcp_subspace_session',
    magicMcpTarget,
    subspaceSessionMapping
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
        authenticate: d.authenticate
      });

      return await proxyMcpRequestToSubspace(
        d.c,
        sessionInfo.magicMcpTarget.target.instance,
        sessionInfo.subspaceSessionMapping.subspaceSessionId
      );
    }
  );
};
