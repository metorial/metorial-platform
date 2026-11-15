import z from 'zod';

export type McpServerOAuthUrlHandlerParams<OAuthConfig extends {}> = {
  authConfig: OAuthConfig;
  clientId: string;
  clientSecret: string;
  state: string;
  redirectUri: string;
};

export type McpServerOAuthUrlHandlerResult = {
  authorizationUrl: string;
  authState?: Record<string, string> | null;
};

export type McpServerOAuthUrlHandlerInternal = <OAuthConfig extends {}>(
  d: McpServerOAuthUrlHandlerParams<OAuthConfig>
) => Promise<McpServerOAuthUrlHandlerResult>;

export type McpServerOAuthUrlHandler = <OAuthConfig extends {}>(
  d: McpServerOAuthUrlHandlerParams<OAuthConfig>
) => Promise<string | McpServerOAuthUrlHandlerResult>;

export type McpServerOAuthCallbackHandlerParams<OAuthConfig extends {}> = {
  authConfig: OAuthConfig;
  authState: Record<string, string>;
  clientId: string;
  clientSecret: string;
  code: string;
  state: string;
  redirectUri: string;
  callbackUrl: string;
  authorizationUrl: string;
};

export type McpServerOAuthCallbackHandlerResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
  [key: string]: any;
};

export type McpServerOAuthCallbackHandler = <OAuthConfig extends {}>(
  d: McpServerOAuthCallbackHandlerParams<OAuthConfig>
) => Promise<McpServerOAuthCallbackHandlerResult>;

export type McpServerOAuthTokenRefreshHandlerParams<OAuthConfig extends {}> = {
  authConfig: OAuthConfig;
  authState: Record<string, string>;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
};

export type McpServerOAuthTokenRefreshHandlerResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
  [key: string]: any;
};

export type McpServerOAuthTokenHandlers = {
  getAuthorizationUrl: McpServerOAuthUrlHandler;
  handleCallback: McpServerOAuthCallbackHandler;
  refreshToken?: McpServerOAuthTokenRefreshHandler;
};

export type McpServerOAuthTokenRefreshHandler = <OAuthConfig extends {}>(
  d: McpServerOAuthTokenRefreshHandlerParams<OAuthConfig>
) => Promise<McpServerOAuthTokenRefreshHandlerResult>;

export type McpServerOAuthValue = {
  accessToken: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
  [key: string]: any;
};

export let authConfigs = new Set<McpServerOAuthConfig<any>>();

export class McpServerOAuthConfig<OAuthConfig extends {}> {
  #value: McpServerOAuthValue | null = null;
  #isRegistered = false;

  #getAuthUrlHandler?: McpServerOAuthUrlHandlerInternal;
  #callbackHandler?: McpServerOAuthCallbackHandler;
  #tokenRefreshHandler?: McpServerOAuthTokenRefreshHandler;

  private constructor(public readonly schema: z.ZodType<OAuthConfig>) {
    authConfigs.add(this);
  }

  static create<OAuthConfig extends {}>(
    ...args:
      | [z.ZodType<OAuthConfig>, McpServerOAuthTokenHandlers]
      | [McpServerOAuthTokenHandlers]
  ) {
    let schema = args.length == 2 ? args[0] : undefined;
    let handlers = args.length == 2 ? args[1] : args[0];

    let config = new McpServerOAuthConfig(schema ?? (z.object({}) as z.ZodType<OAuthConfig>));

    config.getAuthorizationUrl(handlers.getAuthorizationUrl);
    config.handleCallback(handlers.handleCallback);
    if (handlers.refreshToken) {
      config.refreshToken(handlers.refreshToken);
    }

    return config.build();
  }

  static getImplementation(config: McpServerOAuthConfig<any>) {
    if (!config.#getAuthUrlHandler || !config.#callbackHandler) {
      throw new Error('MCP Server auth config is missing required handlers');
    }

    return {
      setValue: config.setValue.bind(config),
      registered: config.registered.bind(config),

      getAuthUrlHandler: config.#getAuthUrlHandler,
      callbackHandler: config.#callbackHandler,
      tokenRefreshHandler: config.#tokenRefreshHandler
    };
  }

  static assertRegistered(config: McpServerOAuthConfig<any>) {
    if (!config.#isRegistered) {
      throw new Error(
        'MCP Server auth config is not registered with `createMcpServer`. Please pass your OAuth config as `authConfig` when creating the server.'
      );
    }
  }

  getAuthorizationUrl(cb: McpServerOAuthUrlHandler) {
    this.#getAuthUrlHandler = async d => {
      let res = await cb(d);
      if (typeof res == 'string') {
        return { authorizationUrl: res };
      }
      return res;
    };
    return this;
  }

  handleCallback(cb: McpServerOAuthCallbackHandler) {
    this.#callbackHandler = cb;
    return this;
  }

  refreshToken(cb: McpServerOAuthTokenRefreshHandler) {
    this.#tokenRefreshHandler = cb;
    return this;
  }

  build(): McpServerOAuthValue {
    if (!this.#getAuthUrlHandler || !this.#callbackHandler) {
      throw new Error('MCP Server auth config is missing required handlers');
    }

    let self = this;

    let ensureReady = () => {
      if (self.#value === null || !self.#isRegistered) {
        throw new Error(
          'MCP Server auth config is not registered with `createMcpServer`. Please pass your OAuth config as `authConfig` when creating the server.'
        );
      }
    };

    // Proxy for getting the config values
    // or throwing an error if not set
    return new Proxy(
      {},
      {
        get: (target, prop, receiver) => {
          if (prop === '__config__') return self;

          if (prop === 'getAll') {
            return () => {
              ensureReady();
              return self.#value;
            };
          }

          if (prop === 'toJSON') {
            return () => {
              ensureReady();
              return self.#value;
            };
          }

          ensureReady();
          return (self.#value as any)[prop];
        },

        ownKeys: target => {
          ensureReady();
          return Reflect.ownKeys(self.#value as object);
        },

        getOwnPropertyDescriptor: (target, prop) => {
          ensureReady();

          let descriptor = Object.getOwnPropertyDescriptor(self.#value as object, prop);
          if (!descriptor) return undefined;

          return {
            ...descriptor,
            configurable: true
          };
        },

        has: (target, prop) => {
          ensureReady();
          return prop in (self.#value as object);
        }
      }
    ) as any as McpServerOAuthValue;
  }

  private setValue(value: McpServerOAuthValue) {
    this.#value = value;
  }

  private registered() {
    this.#isRegistered = true;
  }
}

export let createOAuth = <Config extends {}>(
  ...args: [z.ZodType<Config>, McpServerOAuthTokenHandlers] | [McpServerOAuthTokenHandlers]
) => McpServerOAuthConfig.create(...args);

export let oAuth = createOAuth;

export let getOAuthConfigImplementation = <Config extends {}>(configValue: any) => {
  let self = configValue['__config__'] as McpServerOAuthConfig<Config>;
  return McpServerOAuthConfig.getImplementation(self);
};

export let setOAuthConfigValue = <Config extends {}>(
  configValue: any,
  value: McpServerOAuthValue
) => {
  let self = configValue['__config__'] as McpServerOAuthConfig<Config>;
  let impl = McpServerOAuthConfig.getImplementation(self);

  impl.setValue(value);
  impl.registered();
};

export let registerOAuthConfig = <Config extends {}>(configValue: any) => {
  let self = configValue['__config__'] as McpServerOAuthConfig<Config>;
  let impl = McpServerOAuthConfig.getImplementation(self);
  impl.registered();
};

export let getOAuthConfigSchema = <Config extends {}>(configValue: any) => {
  let self = configValue['__config__'] as McpServerOAuthConfig<Config>;
  return self.schema.toJSONSchema({
    unrepresentable: 'any',
    override: ctx => {
      let def = ctx.zodSchema._zod.def;

      if (def.type === 'date') {
        ctx.jsonSchema.type = 'string';
        ctx.jsonSchema.format = 'date-time';
      }
      if (def.type === 'bigint') {
        ctx.jsonSchema.type = 'number';
      }
    }
  });
};
