import { GetMetorialSDKConfig, MetorialSDKBuilder } from '@metorial/util-endpoint';

export type MetorialKeyPrefix =
  | 'metorial_pk_dev_'
  | 'metorial_sk_dev_'
  | 'metorial_pk_prod_'
  | 'metorial_sk_prod_';

export let sdkBuilder = MetorialSDKBuilder.create<
  '2025-01-01-pulsar',
  {
    apiVersion: '2025-01-01-pulsar';
    apiKey?: `${MetorialKeyPrefix}${string}` | string;
    headers?: Record<string, string>;
    apiHost?: string;
  }
>('metorial-management-api', '2025-01-01-pulsar')
  .setGetApiHost(config => config.apiHost ?? 'https://api.metorial.com')
  .setGetHeaders(config => ({
    'Metorial-Version': config.apiVersion,
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    ...(config.headers ?? {})
  }));

export type MetorialSDKConfig = GetMetorialSDKConfig<typeof sdkBuilder>;
