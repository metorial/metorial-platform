import { MetorialEndpointManager } from './endpoints';

export class MetorialSDKBuilder<
  ApiVersion,
  Config extends {
    apiKey?: string;
    apiVersion: ApiVersion;
    fetch?: typeof fetch;
  }
> {
  #getApiHost?: (config: Config) => string;
  #getHeaders?: (config: Config) => Record<string, string>;

  private constructor(
    private apiName: string,
    private apiVersion: ApiVersion
  ) {}

  static create<ApiVersion, Config extends { apiVersion: ApiVersion; apiKey?: string }>(
    apiName: string,
    apiVersion: ApiVersion
  ): MetorialSDKBuilder<ApiVersion, Config> {
    return new MetorialSDKBuilder(apiName, apiVersion);
  }

  setGetApiHost(getApiHost: (config: Config) => string) {
    this.#getApiHost = getApiHost;
    return this;
  }

  setGetHeaders(getHeaders: (config: Config) => Record<string, string>) {
    this.#getHeaders = getHeaders;
    return this;
  }

  build<SoftConfig extends Partial<Config>>(getConfig: (config: SoftConfig) => Config) {
    if (!this.#getHeaders) {
      throw new Error('getHeaders must be set');
    }

    if (!this.#getApiHost) {
      throw new Error('apiHost must be set');
    }

    return <E extends { [key: string]: any }>(
        getEndpoints: (manager: MetorialEndpointManager<Config>) => E
      ) =>
      (
        config: SoftConfig & {
          enableDebugLogging?: boolean;
        }
      ): E & {
        _config: Config & {
          apiHost: string;
        };
      } => {
        let fullConfig = getConfig(config);
        let apiHost = this.#getApiHost!(fullConfig);

        let manager = new MetorialEndpointManager(
          fullConfig,
          apiHost,
          this.#getHeaders!,
          fullConfig.fetch,
          { enableDebugLogging: !!config.enableDebugLogging }
        );

        return {
          _config: {
            apiHost,
            ...fullConfig
          },

          ...getEndpoints(manager)
        } as any;
      };
  }
}

export type GetMetorialSDKConfig<Builder extends MetorialSDKBuilder<any, any>> =
  Builder extends MetorialSDKBuilder<infer ApiVersion, infer Config> ? Config : never;
