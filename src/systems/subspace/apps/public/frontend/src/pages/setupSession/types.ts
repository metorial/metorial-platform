import type { client } from '../../state/client';

type SetupSessionResponse = NonNullable<Awaited<ReturnType<typeof client.setupSession.get>>>;

export type Session = SetupSessionResponse['session'];
export type Provider = SetupSessionResponse['provider'];
export type Brand = SetupSessionResponse['brand'];
export type OAuthSetup = NonNullable<
  Awaited<ReturnType<typeof client.setupSession.getOauthSetup>>
>;

export type Step = 'auth_config' | 'oauth_redirect' | 'oauth_loading' | 'config' | 'completed';
