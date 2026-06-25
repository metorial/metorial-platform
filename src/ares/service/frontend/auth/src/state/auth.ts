import { createLoader } from '@metorial-io/data-hooks';
import { authIntentState } from './authIntent';
import { authClient } from './client';

export let authState = createLoader({
  name: 'auth',
  hash: ai => `auth:${ai.clientId}`,
  fetch: (d: { clientId: string }) => {
    if (typeof window === 'undefined')
      throw new Error('Cannot fetch authIntent on the server');

    return authClient.authentication.boot({ clientId: d.clientId });
  },
  mutators: {
    start: async (
      data:
        | {
            type: 'email';
            clientId: string;
            email: string;
            redirectUrl: string;
            captchaToken?: string;
          }
        | {
            type: 'oauth';
            clientId: string;
            provider: 'google' | 'github';
            redirectUrl: string;
          }
        | {
            type: 'session';
            clientId: string;
            userOrSessionId: string;
            redirectUrl: string;
          }
        | {
            type: 'sso';
            clientId: string;
            ssoTenantId: string;
            redirectUrl: string;
          },
      { input, output }
    ) => {
      let auth = await authClient.authentication.start(data);

      if (auth.type == 'hook') {
        window.location.replace(auth.url);

        // Will never resolve
        return new Promise<never>(() => {});
      } else if (auth.type == 'auth_attempt') {
        let session = await authClient.authAttempt.exchange({
          authAttemptId: auth.authAttempt.id,
          clientSecret: auth.authAttempt.clientSecret
        });

        window.location.replace(session.url);

        // Will never resolve
        return new Promise<never>(() => {});
      } else {
        await authIntentState.fetch({
          authIntentId: auth.authIntent.id,
          authIntentClientSecret: auth.authIntent.clientSecret
        });

        return auth.authIntent;
      }
    }
  }
});
