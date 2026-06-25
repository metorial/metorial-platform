import {
  createMcpServer as createMcpServerInternal,
  CreateMcpServerOpts
} from '@metorial/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import {
  authConfigs,
  getOAuthConfigImplementation,
  getOAuthConfigSchema,
  McpServerOAuthCallbackHandlerParams,
  McpServerOAuthConfig,
  McpServerOAuthTokenRefreshHandlerParams,
  McpServerOAuthUrlHandlerParams,
  registerOAuthConfig,
  setOAuthConfigValue
} from './auth';
import { ClientOpts, getClient, handleMcpMessages } from './client';
import {
  configs,
  getConfigSchema,
  McpServerConfig,
  registerConfig,
  setConfigValue
} from './config';

export type McpServerInstanceServer = CreateMcpServerOpts | { server: McpServer };
let getServer = (instance: McpServerInstanceServer) => {
  if ('server' in instance) {
    return instance.server;
  } else {
    return createMcpServerInternal(instance);
  }
};

export type McpServerInstanceOpts = McpServerInstanceServer & {
  config?: any;
  authConfig?: any;
};

export class McpServerInstance {
  #server: McpServer;

  private constructor(private instance: McpServerInstanceOpts) {
    if (instance.config) registerConfig(instance.config);
    if (instance.authConfig) registerOAuthConfig(instance.authConfig);

    for (let ac of authConfigs) McpServerOAuthConfig.assertRegistered(ac);
    for (let co of configs) McpServerConfig.assertRegistered(co);

    this.#server = getServer(instance);
  }

  static create(instance: McpServerInstanceOpts) {
    return new McpServerInstance(instance);
  }

  async discover() {
    let client = await getClient(this.#server, async notification => {}, {
      client: {
        name: 'Metorial Discovery',
        version: '1.0.0'
      },
      capabilities: {}
    });

    let info = client.getServerVersion();
    let capabilities = client.getServerCapabilities();
    let instructions = client.getInstructions();

    return {
      server: {
        info,
        capabilities,
        instructions
      },

      configSchema: this.instance.config ? getConfigSchema(this.instance.config) : null,
      oauth: this.instance.authConfig
        ? {
            status: 'enabled' as const,
            authConfig: getOAuthConfigSchema(this.instance.authConfig),
            hasTokenRefresh: !!getOAuthConfigImplementation(this.instance.authConfig)
              .tokenRefreshHandler
          }
        : {
            status: 'disabled' as const
          }
    };
  }

  handleMcpMessages(opts: {
    config: any;
    authConfig: any;
    client: ClientOpts;
    message: JSONRPCMessage[];
  }) {
    if (opts.config && this.instance.config) {
      setConfigValue(this.instance.config, opts.config);
    }
    if (opts.authConfig && this.instance.authConfig) {
      setOAuthConfigValue(this.instance.authConfig, opts.authConfig);
    }

    return handleMcpMessages(this.#server, opts.client, opts.message);
  }

  getOauthAuthorizationUrl(d: McpServerOAuthUrlHandlerParams<any>) {
    if (!this.instance.authConfig) return null;
    let impl = getOAuthConfigImplementation(this.instance.authConfig);

    return impl.getAuthUrlHandler(d);
  }

  handleOauthCallback(d: McpServerOAuthCallbackHandlerParams<any>) {
    if (!this.instance.authConfig) return null;
    let impl = getOAuthConfigImplementation(this.instance.authConfig);

    return impl.callbackHandler(d);
  }

  handleOauthTokenRefresh(d: McpServerOAuthTokenRefreshHandlerParams<any>) {
    if (!this.instance.authConfig) return null;
    let impl = getOAuthConfigImplementation(this.instance.authConfig);

    if (!impl.tokenRefreshHandler) {
      return null;
    }

    return impl.tokenRefreshHandler(d);
  }
}

export let createMcpServer = (instance: McpServerInstanceOpts) => {
  return McpServerInstance.create(instance);
};
