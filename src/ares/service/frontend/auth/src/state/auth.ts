import { createLoader } from '@metorial-io/data-hooks';
import { authIntentState } from './authIntent';
import { authClient } from './client';
import type { AuthClient } from '../../../../src/apis/auth/controllers';

type PublicAuthStartInput = Parameters<AuthClient['authentication']['start']>[0];
export type AuthStartInput =
  | PublicAuthStartInput
  | {
      type: 'internal';
      clientId: string;
      token: string;
      redirectUrl: string;
    };
export type AuthStartResponse = Awaited<
  ReturnType<AuthClient['authentication']['start']>
>;
export type AuthConnectionSelection = Extract<AuthStartResponse, { type: 'selection' }>;
export type AuthConnectionOption = AuthConnectionSelection['options'][number];

export type AuthStartOutcome =
  | AuthConnectionSelection
  | Extract<AuthStartResponse, { type: 'auth_intent' }>;

let redirect = (url: string) => {
  window.location.replace(url);

  return new Promise<never>(() => {});
};

let handleStartResponse = async (
  auth: AuthStartResponse,
  input: AuthStartInput
): Promise<AuthStartOutcome> => {
  if (auth.type == 'hook') {
    return redirect(auth.url);
  }

  if (auth.type == 'auth_attempt') {
    let session = await authClient.authAttempt.exchange({
      authAttemptId: auth.authAttempt.id,
      clientSecret: auth.authAttempt.clientSecret
    });

    return redirect(session.url);
  }

  if (auth.type == 'auth_intent') {
    await authIntentState.fetch({
      authIntentId: auth.authIntent.id,
      authIntentClientSecret: auth.authIntent.clientSecret
    });

    return auth;
  }

  if (auth.type == 'selection' && auth.options.length == 1) {
    let option = auth.options[0]!;
    let nextAuth = await authClient.authentication.start({
      type: 'sso',
      clientId: auth.clientId,
      ssoTenantId: option.tenantId,
      ssoConnectionId: option.connectionId,
      email: auth.email,
      redirectUrl: input.redirectUrl
    });

    return handleStartResponse(nextAuth, input);
  }

  return auth;
};

export let authState = createLoader({
  name: 'auth',
  hash: ai => `auth:${ai.clientId}`,
  fetch: (d: { clientId: string }) => {
    if (typeof window === 'undefined')
      throw new Error('Cannot fetch authIntent on the server');

    return authClient.authentication.boot({ clientId: d.clientId });
  },
  mutators: {
    start: async (data: AuthStartInput) => {
      let auth = await authClient.authentication.start(data as PublicAuthStartInput);

      return handleStartResponse(auth, data);
    }
  }
});
