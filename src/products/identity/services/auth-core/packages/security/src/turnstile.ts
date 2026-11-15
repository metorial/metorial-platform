import { checkEdition } from '@metorial/editions';

export let turnstileVerifier = checkEdition('cloud')
  ? (await import('./turnstileCloud')).turnstileVerifier
  : { enabled: false, verify: async (_input: { token: string }) => true };
