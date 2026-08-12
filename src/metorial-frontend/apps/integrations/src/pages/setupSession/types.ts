import type { client } from '../../state/client';

type SetupSessionResponse = NonNullable<Awaited<ReturnType<typeof client.setupSession.get>>>;

export type Session = SetupSessionResponse['session'];
export type Provider = SetupSessionResponse['provider'];
export type Brand = SetupSessionResponse['brand'];
export type OAuthSetup = NonNullable<
  Awaited<ReturnType<typeof client.setupSession.getOauthSetup>>
>;
export type ProviderSearchItem = Awaited<
  ReturnType<typeof client.setupSession.listProviders>
>['items'][number];
export type ToolListItem = Awaited<
  ReturnType<typeof client.setupSession.listTools>
>['items'][number];

export type Step =
  | 'provider'
  | 'auth_config'
  | 'oauth_redirect'
  | 'oauth_loading'
  | 'config'
  | 'completed';
