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
type ToolListResponse = Awaited<
  ReturnType<IntegrationsRpcClient['setupSession']['listTools']>
>;
export type ToolListItem = ToolListResponse['items'][number];
export type ToolCategoryListItem = ToolListResponse['toolCategories'][number];

export type Step =
  | 'provider'
  | 'auth_config'
  | 'oauth_redirect'
  | 'oauth_loading'
  | 'config'
  | 'completed';
