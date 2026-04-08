import {
  forbiddenError,
  notFoundError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { useRequestContext } from '@lowerdeck/hono';
import { extractToken } from '@metorial/bearer';
import { db } from '@metorial/db';
import { generateSnowflakeId } from '@metorial/id';
import { AuthInfo } from '@metorial/module-access';
import {
  ensureMagicMcpSubspaceSession,
  magicMcpServerService,
  MagicMcpSubspaceMapping,
  magicMcpTokenService
} from '@metorial/module-magic';
import { proxyMcpRequestToSubspace } from '@metorial/module-subspace';
import { Authenticator } from '@metorial/rest';
import type { Context } from 'hono';
import { authenticateAndResolveInstance } from './getSession';

type MagicMcpServerForRouting = Awaited<ReturnType<typeof getMagicMcpServerByIdOrAlias>>;

export type MagicMcpSubspaceSessionInfo = {
  type: 'magic_mcp_subspace_session';
  magicMcpServer: MagicMcpServerForRouting;
  subspaceSessionMapping: MagicMcpSubspaceMapping;
};

export let getMagicMcpServerByIdOrAlias = async (magicMcpServerIdOrAlias: string) => {
  let magicMcpServer = await db.magicMcpServer.findFirst({
    where: {
      status: 'active',
      OR: [
        { id: magicMcpServerIdOrAlias },
        {
          aliases: {
            some: {
              slug: magicMcpServerIdOrAlias
            }
          }
        }
      ]
    },
    include: {
      aliases: true,
      instance: true
    }
  });
  if (!magicMcpServer) throw new ServiceError(notFoundError('magic_mcp.server'));

  return magicMcpServer;
};

export let getMagicMcpTokenSecretFromRequest = (request: Request, url: URL) => {
  return url.searchParams.get('key') ?? extractToken(request, url) ?? null;
};

let ensureMagicMcpTokenAccess = async (d: {
  tokenSecret: string;
  magicMcpServer: MagicMcpServerForRouting;
}) => {
  let token = await magicMcpTokenService.getMagicMcpTokenBySecret({
    secret: d.tokenSecret,
    instance: d.magicMcpServer.instance
  });

  let hasAccess = await magicMcpTokenService.checkMagicMcpTokenAccess({
    token,
    server: d.magicMcpServer
  });

  if (!hasAccess) {
    throw new ServiceError(
      forbiddenError({
        message: 'Magic MCP token does not have access to this server'
      })
    );
  }
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
  magicMcpServer: MagicMcpServerForRouting;
}) => {
  let requestForAuth = toApiKeyRequest(d.request, d.tokenSecret);
  let { instance, auth } = await authenticateAndResolveInstance(
    requestForAuth,
    d.url,
    d.authenticate
  );

  if (instance.id !== d.magicMcpServer.instance.id) {
    throw new ServiceError(
      forbiddenError({
        message: 'API key does not have access to this magic MCP server'
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

    await magicMcpServerService.checkConsumerReadAccess({
      server: d.magicMcpServer,
      accessTags: auth.restrictions.consumer.accessTags
    });
  }
};

export let resolveMagicMcpSubspaceSession = async (d: {
  magicMcpServerIdOrAlias: string;
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

  let magicMcpServer = await getMagicMcpServerByIdOrAlias(d.magicMcpServerIdOrAlias);
  if (tokenSecret.startsWith('metorial_mk_')) {
    await ensureMagicMcpTokenAccess({
      tokenSecret,
      magicMcpServer
    });
  } else {
    await ensureMagicMcpApiKeyAccess({
      tokenSecret,
      request: d.request,
      url: d.url,
      authenticate: d.authenticate,
      magicMcpServer
    });
  }

  let subspaceSessionMapping = await ensureMagicMcpSubspaceSession(magicMcpServer);

  return {
    type: 'magic_mcp_subspace_session',
    magicMcpServer,
    subspaceSessionMapping
  };
};

export let handleMagicMcpRequest = async (d: {
  c: Context;
  magicMcpServerIdOrAlias: string;
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
        magicMcpServerIdOrAlias: d.magicMcpServerIdOrAlias,
        request,
        url,
        authenticate: d.authenticate
      });

      return await proxyMcpRequestToSubspace(
        d.c,
        sessionInfo.magicMcpServer.instance,
        sessionInfo.subspaceSessionMapping.subspaceSessionId
      );
    }
  );
};
