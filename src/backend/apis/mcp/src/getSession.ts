import { extractToken } from '@metorial/bearer';
import { Context } from '@metorial/context';
import {
  db,
  Instance,
  MagicMcpToken,
  Organization,
  OrganizationActor,
  ServerOAuthSession
} from '@metorial/db';
import {
  badRequestError,
  notFoundError,
  ServiceError,
  unauthorizedError
} from '@metorial/error';
import { createExecutionContext, provideExecutionContext } from '@metorial/execution-context';
import { accessService, AuthInfo } from '@metorial/module-access';
import { magicMcpServerService, magicMcpTokenService } from '@metorial/module-magic';
import { organizationActorService } from '@metorial/module-organization';
import { serverOAuthSessionService, sessionService } from '@metorial/module-session';
import { Authenticator } from '@metorial/rest';

export let getSessionAndAuthenticate = async (
  d:
    | {
        type: 'session';
        sessionId: string;
      }
    | {
        type: 'magic_mcp_server';
        magicMcpServerId: string;
        oauthSessionId?: string;
        serverSessionId?: string;
      },
  request: Request,
  url: URL,
  authenticate: Authenticator<AuthInfo>,
  context: Context
) => {
  let authTokenSecret = url.searchParams.get('key') ?? extractToken(request, url);

  if (d.type == 'session') {
    if (authTokenSecret?.startsWith('metorial_ek_')) {
      let session = await sessionService.getSessionByClientSecret({
        clientSecret: authTokenSecret
      });
      if (session.id != d.sessionId) {
        throw new ServiceError(
          unauthorizedError({
            message: 'Session ID mismatch',
            description: `The session ID in the URL does not match the session ID the client secret is associated with.`
          })
        );
      }

      return {
        type: 'session_client_secret' as const,
        session,
        instance: session.instance
      };
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

    let instance: Instance & { organization: Organization };
    let token: MagicMcpToken | undefined = undefined;
    let actor: OrganizationActor | undefined = undefined;

    if (authTokenSecret?.startsWith('metorial_mk_')) {
      let token = await magicMcpTokenService.getMagicMcpTokenBySecret({
        secret: authTokenSecret
      });

      token = token;
      instance = token.instance;
    } else {
      let auth = await authenticate(request, url);
      let instanceRes = await accessService.accessInstance({
        authInfo: auth.auth,
        instanceId: server.instance.id
      });
      instance = instanceRes.instance;
      actor = instanceRes.actor;
    }

    if (!actor) {
      actor = await organizationActorService.getSystemActor({
        organization: instance.organization
      });
    }

    let serverDeployment = server.serverDeployment?.serverDeployment;
    if (!serverDeployment) {
      throw new ServiceError(
        badRequestError({
          message: 'Magic MCP server is not properly configured. No server deployment found.'
        })
      );
    }

    if (d.serverSessionId) {
      let serverSession = await db.serverSession.findFirst({
        where: { id: d.serverSessionId },
        include: {
          session: {
            include: {
              serverDeployments: {
                include: {
                  serverDeployment: {
                    include: {
                      server: true,
                      serverVariant: true
                    }
                  }
                }
              }
            }
          }
        }
      });
      if (!serverSession) throw new ServiceError(notFoundError('session.server_session'));

      return {
        type: 'magic_mcp_session' as const,
        session: serverSession.session,
        instance
      };
    } else {
      let oauthSession: ServerOAuthSession | undefined = undefined;

      if (serverDeployment.oauthConnectionOid) {
        if (!d.oauthSessionId && !server.defaultServerOauthSession) {
          throw new ServiceError(
            badRequestError({
              message: 'OAuth session ID is required for this Magic MCP server.',
              hint: 'You can set up OAuth in the Metorial dashboard or pass an `oauth_session_id` query parameter to the request.'
            })
          );
        }

        if (d.oauthSessionId) {
          oauthSession = await serverOAuthSessionService.getServerOAuthSessionById({
            instance,
            serverOAuthSessionId: d.oauthSessionId
          });
        } else {
          oauthSession = server.defaultServerOauthSession!;
        }
      }

      let session = await provideExecutionContext(
        createExecutionContext({
          type: 'request',
          contextId: '',
          ip: context.ip,
          userAgent: context.ua ?? 'unknown'
        }),
        async () =>
          await sessionService.createSession({
            instance,
            organization: instance.organization,
            performedBy: actor,
            magicMcpToken: token,
            ephemeralPermittedDeployments: new Set(),
            input: {
              connectionType: 'mcp',
              serverDeployments: [
                {
                  deployment: serverDeployment,
                  oauthSession
                }
              ]
            }
          })
      );

      return {
        type: 'magic_mcp_session' as const,
        session,
        instance
      };
    }
  }

  throw new ServiceError(
    unauthorizedError({
      message: 'Invalid authentication method',
      description: `You must authenticate using either a session client secret or a valid Magic MCP token.`
    })
  );
};

export type SessionInfo = Awaited<ReturnType<typeof getSessionAndAuthenticate>>;
