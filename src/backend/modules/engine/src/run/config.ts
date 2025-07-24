import {
  ServerDeployment,
  ServerImplementation,
  ServerVariant,
  ServerVersion
} from '@metorial/db';
import { ServiceError, badRequestError } from '@metorial/error';
import {
  LauncherConfig_LauncherType,
  RunConfigRemoteServer_ServerProtocol,
  SessionConfig
} from '@metorial/mcp-engine-generated';

export let getSessionConfig = async (
  serverDeployment: ServerDeployment & {
    serverVariant: ServerVariant & {
      currentVersion: ServerVersion | null;
    };
    serverImplementation: ServerImplementation;
  },
  DANGEROUSLY_UNENCRYPTED_CONFIG: {}
): Promise<SessionConfig> => {
  let version = serverDeployment.serverVariant.currentVersion!;
  let implementation = serverDeployment.serverImplementation;
  let launchParams = implementation.getLaunchParams ?? version.getLaunchParams;

  let launcher = {
    launcherType: LauncherConfig_LauncherType.deno,
    jsonConfig: JSON.stringify(DANGEROUSLY_UNENCRYPTED_CONFIG),
    code: launchParams
  };

  if (version.sourceType == 'docker') {
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
};
