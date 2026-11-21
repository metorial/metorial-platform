import {
  GetMetorialSDKConfig,
  MetorialSDKBuilder,
  resolveApiHost
} from '@metorial/util-endpoint';

export type MetorialKeyPrefix = 'metorial_pk_';

export let sdkBuilder = MetorialSDKBuilder.create<
  '2026-04-01-consumer',
  {
    apiVersion: '2026-04-01-consumer';
    apiKey?: `${MetorialKeyPrefix}${string}` | string;
    headers?: Record<string, string>;
    apiHost?: string;
  }
>('metorial-consumer-api', '2026-04-01-consumer')
  .setGetApiHost(resolveApiHost)
  .setGetHeaders(config => ({
    'Metorial-Version': config.apiVersion,
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    ...(config.headers ?? {})
  }));

export type MetorialSDKConfig = GetMetorialSDKConfig<typeof sdkBuilder>;
