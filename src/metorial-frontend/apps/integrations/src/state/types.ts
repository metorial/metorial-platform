import type { IntegrationsRpcClient } from './client';

type SetupSessionApi = IntegrationsRpcClient['setupSession'];

type SetupSessionResponse = NonNullable<Awaited<ReturnType<SetupSessionApi['get']>>>;

type ToolListResponse = Awaited<ReturnType<SetupSessionApi['listTools']>>;

export type SessionCredentials = {
  sessionId: string;
  clientSecret: string;
};

export type Session = SetupSessionResponse['session'];

export type Provider = SetupSessionResponse['provider'];

export type Brand = SetupSessionResponse['brand'];

export type OAuthSetup = NonNullable<Awaited<ReturnType<SetupSessionApi['getOauthSetup']>>>;

export type ProviderListing = Awaited<
  ReturnType<SetupSessionApi['listProviders']>
>['items'][number];

export type Tool = ToolListResponse['items'][number];

export type ToolCategory = ToolListResponse['toolCategories'][number];
