import {
  db,
  Instance,
  LambdaServerInstance,
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
import { RunConfigLambdaServer_Protocol } from '@metorial/mcp-engine-generated/ts-proto-gen/remote';
import { providerOauthAuthorizationService } from '@metorial/module-provider-oauth';

let getHeadersWithAuthorization = (
  config: Record<string, any>,
  otherHeaders: Record<string, any>
) => {
  let newHeaders: Record<string, any> = {};
  if (typeof otherHeaders == 'object' && otherHeaders !== null) {
    newHeaders = { ...otherHeaders };
  }

  if (config.token) {
    newHeaders['Authorization'] = 'Bearer ' + config.token;
  }

  if (config.__metorial_oauth__ && config.__metorial_oauth__.accessToken) {
    newHeaders['Authorization'] = 'Bearer ' + config.__metorial_oauth__.accessToken;
  }

  return newHeaders;
};

let knownLaunchers = [
  {
    impl: [
      `(config, ctx) => ({
  query: {},
  headers: ctx.getHeadersWithAuthorization({})
});`
    ],
    functionality: (config: Record<string, any>) => ({
      query: {},
      headers: getHeadersWithAuthorization(config, {})
    })
  },
  {
    impl: [
      `(config, ctx) => ({
  args: config
});`
    ],
    functionality: (config: Record<string, any>) => ({
      args: config
    })
  },
  {
    impl: [
      `(config, ctx) => ({
  args: {
    ...config,

    // Get access to oauth token (if oauth is configured)
    token: config.oauthToken 
  }
});`,
      `(config, ctx) => ({
  args: {
    // Get access to oauth token (if oauth is configured)
    token: config.oauthToken,

    ...config
  }
});`
    ],
    functionality: (config: Record<string, any>) => ({
      args: {
        token: config.oauthToken,
        ...config
      }
    })
  }
];

export let getSessionConfig = async (
  serverDeployment: ServerDeployment & {
    serverVariant: ServerVariant & {
      currentVersion:
        | (ServerVersion & {
            lambda: LambdaServerInstance | null;
          })
        | null;
    };
    serverImplementation: ServerImplementation;
  },
  instance: Instance,
  serverSession: ServerSession | null,
  DANGEROUSLY_UNENCRYPTED_CONFIG: {}
): Promise<SessionConfig> => {
  let version = serverDeployment.serverVariant.currentVersion;
  if (!version) {
    throw new ServiceError(
      badRequestError({
        message: 'This server version does not support runs.',
        reason: 'no_runnable_target'
      })
    );
  }

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

  let DANGEROUSLY_serverConfigWithSecrets = {
    accessToken: oauthToken?.accessToken,
    oauthToken: oauthToken?.accessToken,
    token: oauthToken?.accessToken,
    oauth: oauthToken
      ? {
          accessToken: oauthToken.accessToken,
          token: oauthToken.accessToken,
          secret: oauthToken.accessToken
        }
      : undefined,
    fields: oauthToken?.fields,
    ...(oauthToken?.additionalAuthData as any),
    ...DANGEROUSLY_UNENCRYPTED_CONFIG,
    __metorial_oauth__: oauthToken ? { accessToken: oauthToken.accessToken } : undefined
  };

  let launcher = {
    launcherType: LauncherConfig_LauncherType.deno,
    jsonConfig: JSON.stringify(DANGEROUSLY_serverConfigWithSecrets),
    code: launchParams
  };

  let knownLauncher = knownLaunchers.find(k => k.impl.includes(launchParams.trim()));

  let mcpConfig = {
    mcpVersion: version.mcpVersion
  };

  if (version.sourceType == 'docker') {
    if (!version.dockerImage) {
      throw new ServiceError(
        badRequestError({
          message: 'This server version does not support container runs.'
        })
      );
    }

    let container = {
      dockerImage: `${version.dockerImage}:${version.dockerTag ?? 'latest'}`,
      maxCpu: '0.5',
      maxMemory: '256mb'
    };

    return {
      serverConfig: {
        containerRunConfigWithLauncher: {
          launcher,
          container
        }
      },

      mcpConfig
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

    let server = {
      serverUri: version.remoteUrl,
      protocol:
        version.remoteServerProtocol == 'sse'
          ? RunConfigRemoteServer_ServerProtocol.sse
          : RunConfigRemoteServer_ServerProtocol.streamable_http
    };

    return {
      serverConfig: knownLauncher
        ? {
            remoteRunConfigWithServer: {
              arguments: knownLauncher.functionality(
                DANGEROUSLY_serverConfigWithSecrets
              ) as any,
              server
            }
          }
        : {
            remoteRunConfigWithLauncher: {
              launcher,
              server
            }
          },

      mcpConfig
    };
  }

  if (version.sourceType == 'managed') {
    if (!version.lambda) {
      throw new ServiceError(
        badRequestError({
          message: 'This server version does not support managed runs.'
        })
      );
    }

    let server = {
      protocol: RunConfigLambdaServer_Protocol.metorial_stellar_over_websocket_v1,
      providerResourceAccessIdentifier: version.lambda.providerResourceAccessIdentifier!,
      securityToken: version.lambda.securityToken!
    };

    return {
      serverConfig: knownLauncher
        ? {
            lambdaRunConfigWithServer: {
              arguments: {
                jsonArguments: JSON.stringify(
                  // @ts-ignore
                  knownLauncher.functionality(DANGEROUSLY_serverConfigWithSecrets).args || {}
                )
              },
              server
            }
          }
        : {
            lambdaRunConfigWithLauncher: {
              launcher,
              server
            }
          },

      statefulServerInfo: {
        toolsJson: JSON.stringify(version.tools),
        promptsJson: JSON.stringify(version.prompts),
        resourceTemplatesJson: JSON.stringify(version.resourceTemplates),
        capabilitiesJson: JSON.stringify(version.serverCapabilities),
        serverInfoJson: JSON.stringify(version.serverInfo),
        instructionsJson: JSON.stringify(version.serverInstructions)
      },

      mcpConfig
    };
  }

  throw new ServiceError(
    badRequestError({
      message: 'Cannot connect to this server version.',
      reason: 'no_runnable_target'
    })
  );
};
