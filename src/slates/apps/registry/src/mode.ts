import { checkEdition, perEdition } from '@metorial/editions';
import { env } from './env';

export let registryMode =
  env.mirror.SLATES_REGISTRY_MODE ??
  perEdition<'root' | 'mirror'>({ cloud: 'root', 'on-prem': 'mirror' });

export let isMirrorMode = () => registryMode === 'mirror';

export let isRootMode = () => registryMode === 'root';

// On-prem always verifies; only development stacks may opt out.
export let isSignatureVerificationRequired = () =>
  checkEdition('on-prem') || env.mirror.SLATES_SIGNATURE_VERIFICATION !== 'disabled';

export let isSigningEnabled = () =>
  isRootMode() && !!env.encryption.SLATES_REGISTRY_ENCRYPTION_KEY;
