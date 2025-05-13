import { GetMetorialSDKConfig, MetorialSDKBuilder } from '@metorial/util-endpoint';

export type MetorialKeyPrefix = 'metorial_pk_' | 'metorial_sk_';

export let sdkBuilder = MetorialSDKBuilder.create<
  '2025-01-01-pulsar',
  {
    apiVersion: '2025-01-01-pulsar';
    apiKey: `${MetorialKeyPrefix}${string}` | string;
    headers?: Record<string, string>;
    apiHost?: string;
  }
>('metorial-public-api', '2025-01-01-pulsar')
  .setGetApiHost(config => config.apiHost ?? 'https://api.metorial.com')
  .setGetHeaders(config => ({
    Authorization: `Bearer ${config.apiKey}`,
    'Metorial-Version': config.apiVersion,
    ...(config.headers ?? {})
  }));

export type MetorialSDKConfig = GetMetorialSDKConfig<typeof sdkBuilder>;
