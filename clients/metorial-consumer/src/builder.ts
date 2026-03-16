import { GetMetorialSDKConfig, MetorialSDKBuilder } from '@metorial/util-endpoint';

export type MetorialKeyPrefix = 'metorial_pk_';

export let sdkBuilder = MetorialSDKBuilder.create<
  '2026-01-01-magnetar',
  {
    apiVersion: '2026-01-01-magnetar';
    apiKey?: `${MetorialKeyPrefix}${string}` | string;
    headers?: Record<string, string>;
    apiHost?: string;
    consumerToken: string;
  }
>('metorial-consumer-api', '2026-01-01-magnetar')
  .setGetApiHost(config => config.apiHost ?? 'https://api.metorial.com')
  .setGetHeaders(config => ({
    'Metorial-Version': config.apiVersion,
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    ...(config.headers ?? {})
  }));

export type MetorialSDKConfig = GetMetorialSDKConfig<typeof sdkBuilder>;
