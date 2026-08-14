import type { IntegrationsRpcClient } from '../../state/client';

type SetupSessionResponse = NonNullable<
  Awaited<ReturnType<IntegrationsRpcClient['setupSession']['get']>>
>;

export type Session = SetupSessionResponse['session'];
export type Provider = SetupSessionResponse['provider'];
export type Brand = SetupSessionResponse['brand'];
export type OAuthSetup = NonNullable<
  Awaited<ReturnType<IntegrationsRpcClient['setupSession']['getOauthSetup']>>
>;
export type ProviderSearchItem = Awaited<
  ReturnType<IntegrationsRpcClient['setupSession']['listProviders']>
>['items'][number];
export type ToolListItem = Awaited<
  ReturnType<IntegrationsRpcClient['setupSession']['listTools']>
>['items'][number];

export type Step =
  | 'provider'
  | 'auth_config'
  | 'oauth_redirect'
  | 'oauth_loading'
  | 'config'
  | 'completed';
