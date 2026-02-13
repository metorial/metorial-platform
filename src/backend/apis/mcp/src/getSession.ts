import { extractToken } from '@metorial/bearer';
import { Context } from '@metorial/context';
import { db, OrganizationActor, Prisma } from '@metorial/db';
import {
  badRequestError,
  forbiddenError,
  ServiceError,
  unauthorizedError
} from '@metorial/error';
import { accessService, AuthInfo } from '@metorial/module-access';
import {
  magicMcpServerService,
  magicMcpSubspaceSessionService,
  magicMcpTokenService
} from '@metorial/module-magic';
import { organizationActorService } from '@metorial/module-organization';
import { sessionService } from '@metorial/module-session';
import { getSubspaceSolutionIdentifier, getTenantForSubspace } from '@metorial/module-subspace';
import { Authenticator } from '@metorial/rest';

type MagicMcpServerForRouting = Prisma.MagicMcpServerGetPayload<{
  include: {
    aliases: true;
    subspaceSession: true;
    instance: true;
  };
}>;

type MagicMcpSubspaceMappingWithServer = Prisma.MagicMcpServerSubspaceSessionGetPayload<{
  include: {
    magicMcpServer: {
      include: {
        aliases: true;
        subspaceSession: true;
        instance: true;
      };
    };
  };
}>;

type MagicMcpTokenWithInstance = Awaited<ReturnType<typeof magicMcpTokenService.getMagicMcpTokenBySecret>>;
type MagicMcpRoutingInstance = MagicMcpTokenWithInstance['instance'];

let resolveMagicMcpAuthContext = async (d: {
  server: MagicMcpServerForRouting;
  authTokenSecret: string | null;
  request: Request;
  url: URL;
  authenticate: Authenticator<AuthInfo>;
}) => {
  let token: MagicMcpTokenWithInstance | undefined;
  let actor: OrganizationActor | undefined;
  let instance: MagicMcpRoutingInstance;

  if (d.authTokenSecret?.startsWith('metorial_mk_')) {
    token = await magicMcpTokenService.getMagicMcpTokenBySecret({
      secret: d.authTokenSecret,
      instance: d.server.instance
    });

    let ok = await magicMcpTokenService.checkMagicMcpTokenAccess({
      token,
      server: d.server
    });
    if (!ok) {
      throw new ServiceError(
        forbiddenError({
          message: 'Magic MCP token does not have access to this Magic MCP server.'
        })
      );
    }

    instance = token.instance;
  } else {
    let auth = await d.authenticate(d.request, d.url);
    let instanceRes = await accessService.accessInstance({
      authInfo: auth.auth,
      instanceId: d.server.instance.id
    });
    instance = instanceRes.instance;
    actor = instanceRes.actor;
  }

  if (!actor) {
    actor = await organizationActorService.getSystemActor({
      organization: instance.organization
    });
  }

  return { instance, actor, token };
};

let resolveMagicMcpSubspaceSession = async (d: {
  server: MagicMcpServerForRouting;
  mapping?: Pick<
    MagicMcpSubspaceMappingWithServer,
    'subspaceSessionId' | 'subspaceSessionTemplateId'
  >;
  authTokenSecret: string | null;
  request: Request;
  url: URL;
  authenticate: Authenticator<AuthInfo>;
}) => {
  if (d.server.status !== 'active') {
    throw new ServiceError(
      forbiddenError({
        message: 'Magic MCP server is not active.'
      })
    );
  }

  let { instance, actor, token } = await resolveMagicMcpAuthContext({
    server: d.server,
    authTokenSecret: d.authTokenSecret,
    request: d.request,
    url: d.url,
    authenticate: d.authenticate
  });

  let subspaceSessionTemplateId = d.server.subspaceSessionTemplateId;
  if (!subspaceSessionTemplateId) {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP server is not properly configured. Missing Subspace session template.'
      })
    );
  }

  let mapping =
    d.mapping ??
    (await magicMcpSubspaceSessionService.ensureSessionForMagicServer({
      magicMcpServer: d.server,
      instance,
      organization: instance.organization,
      organizationActor: actor
    }));

  let { tenant, environment } = await getTenantForSubspace(instance.organization, instance);

  return {
    type: 'magic_mcp_subspace_session' as const,
    instance,
    organization: instance.organization,
    actor,
    token,
    magicMcpServer: d.server,
    subspaceSessionId: mapping.subspaceSessionId,
    subspaceSessionTemplateId: mapping.subspaceSessionTemplateId,
    subspaceSolutionId: getSubspaceSolutionIdentifier(),
    subspaceTenantId: tenant.id,
    subspaceTenantIdentifier: tenant.identifier,
    subspaceEnvironmentId: environment.id,
    subspaceEnvironmentIdentifier: environment.identifier
  };
};

export let getSessionAndAuthenticate = async (
  d:
    | {
        type: 'session';
        sessionId: string;
      }
    | {
        type: 'magic_mcp_server';
        magicMcpServerId: string;
      },
  request: Request,
  url: URL,
  authenticate: Authenticator<AuthInfo>,
  _context: Context
) => {
  let authTokenSecret = (url.searchParams.get('key') ?? extractToken(request, url)) ?? null;

  if (d.type == 'session') {
    if (authTokenSecret?.startsWith('metorial_ek_')) {
      let session = await sessionService.getSessionByClientSecret({
        clientSecret: authTokenSecret
      });
      if (session.id != d.sessionId) {
        throw new ServiceError(
          unauthorizedError({
            message: 'Session ID mismatch',
            description:
              'The session ID in the URL does not match the session ID the client secret is associated with.'
          })
        );
      }

      return {
        type: 'session_client_secret' as const,
        session,
        instance: session.instance
      };
    }

    let mapping = await db.magicMcpServerSubspaceSession.findFirst({
      where: {
        subspaceSessionId: d.sessionId
      },
      include: {
        magicMcpServer: {
          include: {
            aliases: true,
            subspaceSession: true,
            instance: true
          }
        }
      }
    });

    if (mapping) {
      return await resolveMagicMcpSubspaceSession({
        server: mapping.magicMcpServer,
        mapping,
        authTokenSecret,
        request,
        url,
        authenticate
      });
    }

    let auth = await authenticate(request, url);

    let session = await sessionService.DANGEROUSLY_getSessionOnlyById({
      sessionId: d.sessionId
    });

    let instance = await accessService.accessInstance({
      authInfo: auth.auth,
      instanceId: session.instance.id
    });

    return {
      session,
      ...auth,
      ...instance,

      type: 'authenticated' as const
    };
  }

  if (d.type == 'magic_mcp_server') {
    let server = await magicMcpServerService.DANGEROUSLY_getMagicMcpServerOnlyById({
      magicMcpServerId: d.magicMcpServerId
    });

    return await resolveMagicMcpSubspaceSession({
      server,
      authTokenSecret,
      request,
      url,
      authenticate
    });
  }

  throw new ServiceError(
    unauthorizedError({
      message: 'Invalid authentication method',
      description:
        'You must authenticate using either a session client secret or a valid Magic MCP token.'
    })
  );
};

export type SessionInfo = Awaited<ReturnType<typeof getSessionAndAuthenticate>>;
