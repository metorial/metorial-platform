import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getSessionConfig } from '../src/run/config';
import type {
  ServerDeployment,
  Instance,
  ServerSession,
  ServerVariant,
  ServerVersion,
  LambdaServerInstance,
  ServerImplementation
} from '@metorial/db';
import {
  LauncherConfig_LauncherType,
  RunConfigRemoteServer_ServerProtocol
} from '@metorial/mcp-engine-generated';
import { RunConfigLambdaServer_Protocol } from '@metorial/mcp-engine-generated/ts-proto-gen/remote';

// Mock the dependencies
vi.mock('@metorial/db', () => ({
  db: {
    sessionServerDeployment: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-provider-oauth', () => ({
  providerOauthAuthorizationService: {
    useAuthToken: vi.fn()
  }
}));

vi.mock('@metorial/error', () => ({
  ServiceError: class ServiceError extends Error {
    constructor(public error: any) {
      super(error.message);
    }
  },
  badRequestError: (opts: any) => opts
}));

const { db } = await import('@metorial/db');
const { providerOauthAuthorizationService } = await import('@metorial/module-provider-oauth');
const { ServiceError } = await import('@metorial/error');

describe('getSessionConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error if version is null', async () => {
    const mockDeployment = {
      oid: 'deployment-oid',
      serverVariant: {
        currentVersion: null
      },
      serverImplementation: {
        getLaunchParams: '(config, ctx) => ({ args: config })'
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;
    const mockSession = { oid: 'session-oid' } as ServerSession;

    await expect(
      getSessionConfig(mockDeployment, mockInstance, mockSession, {})
    ).rejects.toThrow(ServiceError);
  });

  it('should generate docker container configuration', async () => {
    const mockVersion: ServerVersion & { lambda: null } = {
      oid: 'version-oid',
      sourceType: 'docker',
      dockerImage: 'myapp/server',
      dockerTag: 'v1.0',
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: config })',
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    const result = await getSessionConfig(mockDeployment, mockInstance, null, {
      customField: 'value'
    });

    expect(result).toEqual({
      serverConfig: {
        containerRunConfigWithLauncher: {
          launcher: {
            launcherType: LauncherConfig_LauncherType.deno,
            jsonConfig: JSON.stringify({ customField: 'value' }),
            code: '(config, ctx) => ({ args: config })'
          },
          container: {
            dockerImage: 'myapp/server:v1.0',
            maxCpu: '0.5',
            maxMemory: '256mb'
          }
        }
      },
      mcpConfig: {
        mcpVersion: '1.0.0'
      }
    });
  });

  it('should throw error for docker source without docker image', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'docker',
      dockerImage: null,
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: config })',
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    await expect(getSessionConfig(mockDeployment, mockInstance, null, {})).rejects.toThrow(
      ServiceError
    );
  });

  it('should generate remote server configuration with SSE protocol', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'remote',
      remoteUrl: 'https://api.example.com',
      remoteServerProtocol: 'sse',
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: config })',
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    const result = await getSessionConfig(mockDeployment, mockInstance, null, {});

    expect(result.serverConfig).toHaveProperty('remoteRunConfigWithLauncher');
    expect(result.serverConfig.remoteRunConfigWithLauncher?.server).toEqual({
      serverUri: 'https://api.example.com',
      protocol: RunConfigRemoteServer_ServerProtocol.sse
    });
  });

  it('should generate remote server configuration with streamable_http protocol', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'remote',
      remoteUrl: 'https://api.example.com',
      remoteServerProtocol: 'streamable_http',
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: config })',
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    const result = await getSessionConfig(mockDeployment, mockInstance, null, {});

    expect(result.serverConfig.remoteRunConfigWithLauncher?.server).toEqual({
      serverUri: 'https://api.example.com',
      protocol: RunConfigRemoteServer_ServerProtocol.streamable_http
    });
  });

  it('should throw error for remote source without remote URL', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'remote',
      remoteUrl: null,
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: config })',
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    await expect(getSessionConfig(mockDeployment, mockInstance, null, {})).rejects.toThrow(
      ServiceError
    );
  });

  it('should generate managed/lambda server configuration', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'managed',
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: config })',
      tools: [{ name: 'tool1' }],
      prompts: [{ name: 'prompt1' }],
      resourceTemplates: [{ name: 'resource1' }],
      serverCapabilities: { streaming: true },
      serverInfo: { name: 'Test Server' },
      serverInstructions: 'Instructions here',
      lambda: {
        oid: 'lambda-oid',
        providerResourceAccessIdentifier: 'resource-id',
        securityToken: 'token-123'
      }
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    const result = await getSessionConfig(mockDeployment, mockInstance, null, {});

    expect(result.serverConfig).toHaveProperty('lambdaRunConfigWithLauncher');
    expect(result.serverConfig.lambdaRunConfigWithLauncher?.server).toEqual({
      protocol: RunConfigLambdaServer_Protocol.metorial_stellar_over_websocket_v1,
      providerResourceAccessIdentifier: 'resource-id',
      securityToken: 'token-123'
    });
    expect(result.statefulServerInfo).toBeDefined();
    expect(result.statefulServerInfo?.toolsJson).toBe(JSON.stringify([{ name: 'tool1' }]));
  });

  it('should throw error for managed source without lambda', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'managed',
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: config })',
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    await expect(getSessionConfig(mockDeployment, mockInstance, null, {})).rejects.toThrow(
      ServiceError
    );
  });

  it('should handle OAuth token in configuration', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'docker',
      dockerImage: 'myapp/server',
      dockerTag: 'latest',
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: config })',
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: 'oauth-connection-oid',
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;
    const mockSession = { oid: 'session-oid', sessionOid: 'parent-session-oid' } as ServerSession;

    const mockSessionDeployment = {
      oid: 'session-deployment-oid',
      serverDeploymentOid: 'deployment-oid',
      sessionOid: 'parent-session-oid',
      oauthSession: {
        status: 'completed',
        tokenReferenceOid: 'token-ref-oid'
      }
    };

    const mockOAuthToken = {
      accessToken: 'oauth-access-token',
      fields: { username: 'testuser' },
      additionalAuthData: { scope: 'read' }
    };

    vi.mocked(db.sessionServerDeployment.findFirst).mockResolvedValue(
      mockSessionDeployment as any
    );
    vi.mocked(providerOauthAuthorizationService.useAuthToken).mockResolvedValue(
      mockOAuthToken as any
    );

    const result = await getSessionConfig(mockDeployment, mockInstance, mockSession, {
      existingField: 'value'
    });

    // Verify OAuth token is included in the config
    const jsonConfig = JSON.parse(
      result.serverConfig.containerRunConfigWithLauncher!.launcher.jsonConfig
    );
    expect(jsonConfig).toMatchObject({
      accessToken: 'oauth-access-token',
      oauthToken: 'oauth-access-token',
      token: 'oauth-access-token',
      fields: { username: 'testuser' },
      scope: 'read',
      existingField: 'value',
      __metorial_oauth__: { accessToken: 'oauth-access-token' }
    });
  });

  it('should throw error if OAuth session is not completed', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'docker',
      dockerImage: 'myapp/server',
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: config })',
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: 'oauth-connection-oid',
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;
    const mockSession = { oid: 'session-oid', sessionOid: 'parent-session-oid' } as ServerSession;

    const mockSessionDeployment = {
      oid: 'session-deployment-oid',
      oauthSession: {
        status: 'pending',
        tokenReferenceOid: 'token-ref-oid'
      }
    };

    vi.mocked(db.sessionServerDeployment.findFirst).mockResolvedValue(
      mockSessionDeployment as any
    );

    await expect(
      getSessionConfig(mockDeployment, mockInstance, mockSession, {})
    ).rejects.toThrow(ServiceError);
  });

  it('should use known launcher for remote config with authorization header', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'remote',
      remoteUrl: 'https://api.example.com',
      remoteServerProtocol: 'sse',
      mcpVersion: '1.0.0',
      getLaunchParams: `(config, ctx) => ({
  query: {},
  headers: ctx.getHeadersWithAuthorization({})
});`,
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    const result = await getSessionConfig(mockDeployment, mockInstance, null, {
      token: 'my-token'
    });

    // Should use remoteRunConfigWithServer instead of remoteRunConfigWithLauncher
    expect(result.serverConfig).toHaveProperty('remoteRunConfigWithServer');
    expect(result.serverConfig.remoteRunConfigWithServer?.arguments).toEqual({
      query: {},
      headers: { Authorization: 'Bearer my-token' }
    });
  });

  it('should prioritize implementation getLaunchParams over version', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'docker',
      dockerImage: 'myapp/server',
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: { version: true } })',
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: '(config, ctx) => ({ args: { implementation: true } })'
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    const result = await getSessionConfig(mockDeployment, mockInstance, null, {});

    // Should use implementation's getLaunchParams (has priority)
    expect(result.serverConfig.containerRunConfigWithLauncher?.launcher.code).toBe(
      '(config, ctx) => ({ args: { implementation: true } })'
    );
  });

  it('should use implementation getLaunchParams if version does not have it', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'docker',
      dockerImage: 'myapp/server',
      mcpVersion: '1.0.0',
      getLaunchParams: null,
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: '(config, ctx) => ({ args: { implementation: true } })'
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    const result = await getSessionConfig(mockDeployment, mockInstance, null, {});

    // Should use implementation's getLaunchParams
    expect(result.serverConfig.containerRunConfigWithLauncher?.launcher.code).toBe(
      '(config, ctx) => ({ args: { implementation: true } })'
    );
  });

  it('should throw error for unsupported source type', async () => {
    const mockVersion = {
      oid: 'version-oid',
      sourceType: 'unsupported',
      mcpVersion: '1.0.0',
      getLaunchParams: '(config, ctx) => ({ args: config })',
      lambda: null
    } as any;

    const mockDeployment = {
      oid: 'deployment-oid',
      oauthConnectionOid: null,
      serverVariant: {
        currentVersion: mockVersion
      },
      serverImplementation: {
        getLaunchParams: null
      }
    } as any;

    const mockInstance = { oid: 'instance-oid' } as Instance;

    await expect(getSessionConfig(mockDeployment, mockInstance, null, {})).rejects.toThrow(
      ServiceError
    );
  });
});
