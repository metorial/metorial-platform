import { ServiceError, badRequestError } from '@metorial/error';
import {
  LauncherConfig_LauncherType,
  RunConfigRemoteServer_ServerProtocol,
  SessionConfig
} from '@metorial/mcp-engine-generated';
import { getFullServerSession } from './utils';

export let getSessionConfig = async (
  input: NonNullable<Awaited<ReturnType<typeof getFullServerSession>>>,
  DANGEROUSLY_UNENCRYPTED_CONFIG: {}
): Promise<SessionConfig> => {
  let version = input.serverDeployment.serverVariant.currentVersion!;
  let implementation = input.serverDeployment.serverImplementation;
  let launchParams = implementation.getLaunchParams ?? version.getLaunchParams;

  let launcher = {
    launcherType: LauncherConfig_LauncherType.deno,
    jsonConfig: JSON.stringify(DANGEROUSLY_UNENCRYPTED_CONFIG),
    code: launchParams
  };

  if (version.sourceType == 'docker') {
    return {
      containerRunConfigWithLauncher: {
        launcher,
        container: {
          dockerImage: `${version.dockerImage}:${version.dockerTag}`,
          maxCpu: '0.5',
          maxMemory: '256mb'
        }
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
    remoteRunConfigWithLauncher: {
      launcher,
      server: {
        serverUri: version.remoteUrl,
        protocol: RunConfigRemoteServer_ServerProtocol.sse // TODO: add support for streamable_http
      }
    }
  };
};
