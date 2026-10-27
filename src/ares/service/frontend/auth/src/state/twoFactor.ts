import { createLoader, useMutation } from '@metorial-io/data-hooks';
import {
  startAuthentication,
  startRegistration,
  type RegistrationResponseJSON
} from '@simplewebauthn/browser';
import { authClient } from './client';

export type SetupCredentials = { setupId: string; clientSecret: string };

export let twoFactorSetupState = createLoader({
  name: 'twoFactorSetup',
  fetch: (input: SetupCredentials) => authClient.twoFactor.getSetup(input),
  mutators: {
    confirmTotp: async (code: string, { input, setOutput }) => {
      let result = await authClient.twoFactor.confirmTotp({ ...input, code });
      setOutput(result);
      return result;
    },

    register: async (_: void, { input }) => {
      let optionsJSON = await authClient.twoFactor.registrationOptions(input);
      return startRegistration({ optionsJSON });
    },

    confirmPasskey: async (
      d: { name: string; response: RegistrationResponseJSON },
      { input, setOutput }
    ) => {
      let result = await authClient.twoFactor.confirmPasskey({ ...input, ...d });
      setOutput(result);
      return result;
    },

    recoveryCodes: (_: void, { input }) => authClient.twoFactor.takeRecoveryCodes(input),

    cancel: async (_: void, { input }) => {
      let result = await authClient.twoFactor.cancel(input);
      window.location.replace(result.returnUrl);
    }
  }
});

export type TwoFactorChallengeCredentials = {
  authIntentId: string;
  clientSecret: string;
  stepId: string;
};

export let twoFactorChallengeState = createLoader({
  name: 'twoFactorChallenge',
  fetch: (input: TwoFactorChallengeCredentials) => authClient.twoFactor.loginOptions(input),
  mutators: {}
});

export let useTwoFactorChallengeCode = (input: TwoFactorChallengeCredentials) =>
  useMutation(
    (d: { type: 'totp' | 'recovery_code'; code: string }) =>
      authClient.twoFactor.verify({ ...input, input: d }),
    { disableToast: true }
  );

export let useTwoFactorChallengePasskey = (input: TwoFactorChallengeCredentials) =>
  useMutation(
    async (_: void) => {
      let optionsJSON = await authClient.twoFactor.authenticationOptions(input);
      let response = await startAuthentication({ optionsJSON });

      return authClient.twoFactor.verify({ ...input, input: { type: 'passkey', response } });
    },
    { disableToast: true }
  );
