import {
  db,
  Instance,
  ServerDeployment,
  ServerImplementation,
  ServerSession,
  ServerVariant,
  ServerVersion
} from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import {
  LauncherConfig_LauncherType,
  RunConfigRemoteServer_ServerProtocol,
  SessionConfig
} from '@metorial/mcp-engine-generated';
import { providerOauthAuthorizationService } from '@metorial/module-provider-oauth';

export let getSessionConfig = async (
  serverDeployment: ServerDeployment & {
    serverVariant: ServerVariant & {
      currentVersion: ServerVersion | null;
    };
    serverImplementation: ServerImplementation;
  },
  instance: Instance,
  serverSession: ServerSession | null,
  DANGEROUSLY_UNENCRYPTED_CONFIG: {}
): Promise<SessionConfig> => {
  let version = serverDeployment.serverVariant.currentVersion!;
  let implementation = serverDeployment.serverImplementation;
  let launchParams = implementation.getLaunchParams ?? version.getLaunchParams;

  let sessionServerDeployment = serverDeployment.oauthConnectionOid
    ? await db.sessionServerDeployment.findFirst({
        where: {
          serverDeploymentOid: serverDeployment.oid,

          // Can be undefined for auto discovery runs
          sessionOid: serverSession?.sessionOid ?? undefined
        },
        include: {
          oauthSession: true
        }
      })
    : null;

  if (
    sessionServerDeployment?.oauthSession &&
    sessionServerDeployment?.oauthSession.status != 'completed'
  ) {
    throw new ServiceError(badRequestError({}));
  }

  let oauthToken = sessionServerDeployment?.oauthSession
    ? await providerOauthAuthorizationService.useAuthToken({
        instance,
        referenceOid: sessionServerDeployment.oauthSession.tokenReferenceOid!
      })
    : null;

  let launcher = {
    launcherType: LauncherConfig_LauncherType.deno,
    jsonConfig: JSON.stringify({
      ...DANGEROUSLY_UNENCRYPTED_CONFIG,
      __metorial_oauth__: oauthToken ? { accessToken: oauthToken.accessToken } : undefined
    }),
    code: launchParams
  };

  if (version.sourceType == 'docker') {
    if (!version.dockerImage) {
      throw new ServiceError(
        badRequestError({
          message: 'This server version does not support container runs.'
        })
      );
    }

    return {
      serverConfig: {
        containerRunConfigWithLauncher: {
          launcher,
          container: {
            dockerImage: `${version.dockerImage}:${version.dockerTag ?? 'latest'}`,
            maxCpu: '0.5',
            maxMemory: '256mb'
          }
        }
      },

      mcpConfig: {
        mcpVersion: version.mcpVersion
      }
    };
  }

  if (version.sourceType == 'remote') {
    if (!version.remoteUrl) {
      throw new ServiceError(
        badRequestError({
          message: 'This server version does not support remote runs.'
        })
      );
    }

    return {
      serverConfig: {
        remoteRunConfigWithLauncher: {
          launcher,
          server: {
            serverUri: version.remoteUrl,
            protocol:
              version.mcpTransport == 'sse'
                ? RunConfigRemoteServer_ServerProtocol.sse
                : RunConfigRemoteServer_ServerProtocol.streamable_http
          }
        }
      },

      mcpConfig: {
        mcpVersion: version.mcpVersion
      }
    };
  }

  throw new ServiceError(
    badRequestError({
      message: 'Cannot connect to this server version.',
      reason: 'no_runnable_target'
    })
  );
};
