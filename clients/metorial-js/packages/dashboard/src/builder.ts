import { GetMetorialSDKConfig, MetorialSDKBuilder } from '@metorial/util-endpoint';

export type MetorialKeyPrefix =
  | 'metorial_uk_'
  | 'metorial_mk_'
  | 'metorial_sk_'
  | 'metorial_ak_'
  | 'metorial_pk_';

export let sdkBuilder = MetorialSDKBuilder.create<
  '2025-01-01-dashboard',
  {
    apiVersion: '2025-01-01-dashboard';
    apiKey?: `${MetorialKeyPrefix}${string}` | string;
    headers?: Record<string, string>;
    apiHost?: string;
  }
>('metorial-management-api', '2025-01-01-dashboard')
  .setGetApiHost(config => config.apiHost ?? 'https://api.metorial.com')
  .setGetHeaders(config => ({
    'Metorial-Version': config.apiVersion,
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    ...(config.headers ?? {})
  }));

export type MetorialSDKConfig = GetMetorialSDKConfig<typeof sdkBuilder>;
