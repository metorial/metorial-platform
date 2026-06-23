import { createLoader } from '@metorial-io/data-hooks';
import { authClient } from './client';

export let authIntentState = createLoader({
  name: 'authIntent',
  hash: ai => ai.authIntentId,
  fetch: (d: { authIntentId: string; authIntentClientSecret: string }) => {
    if (typeof window === 'undefined')
      throw new Error('Cannot fetch authIntent on the server');

    return authClient.authIntent.get({
      authIntentId: d.authIntentId,
      clientSecret: d.authIntentClientSecret
    });
  },
  mutators: {
    verifyCaptcha: async (d: { token: string }, { input, output, setOutput }) => {
      let ai = await authClient.authIntent.verifyCaptcha({
        authIntentId: input.authIntentId,
        clientSecret: input.authIntentClientSecret,
        token: d.token
      });

      setOutput(ai);

      return ai;
    },

    verifyStep: async (
      d: { input: { type: 'email_code'; code: string }; stepId: string },
      { input, output, setOutput }
    ) => {
      let ai = await authClient.authIntent.verifyStep({
        authIntentId: input.authIntentId,
        clientSecret: input.authIntentClientSecret,
        input: d.input,
        stepId: d.stepId
      });

      setOutput(ai);

      return ai;
    },

    resendStep: async ({ stepId }: { stepId: string }, { input, output, setOutput }) => {
      let ai = await authClient.authIntent.resendStep({
        authIntentId: input.authIntentId,
        clientSecret: input.authIntentClientSecret,
        stepId
      });

      setOutput(ai);

      return ai;
    },

    createUser: (
      d: {
        termsAccepted: boolean;
        firstName: string;
        lastName: string;
        timezone: string;
      },
      { input, output }
    ) => {
      return authClient.authIntent.createUser({
        authIntentId: input.authIntentId,
        clientSecret: input.authIntentClientSecret,

        input: {
          acceptedTerms: d.termsAccepted,
          firstName: d.firstName,
          lastName: d.lastName
        }
      });
    },

    complete: async (_: void, { input, output }) => {
      let authAttempt = await authClient.authAttempt.create({
        from: 'auth_intent',
        authIntent: {
          id: input.authIntentId,
          clientSecret: input.authIntentClientSecret
        }
      });

      let session = await authClient.authAttempt.exchange({
        authAttemptId: authAttempt.id,
        clientSecret: authAttempt.clientSecret
      });

      window.location.replace(session.url);
    }
  }
});
