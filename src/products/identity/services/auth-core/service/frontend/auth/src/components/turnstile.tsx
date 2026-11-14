import { checkEdition } from '@metorial/editions';
import type { Turnstile as CloudTurnstile } from '@marsidev/react-turnstile';

export let Turnstile = (
  checkEdition('cloud') ? (await import('@marsidev/react-turnstile')).Turnstile : () => null
) as typeof CloudTurnstile;
