import { ServiceError, preconditionFailedError } from '@lowerdeck/error';
import { Encryption } from '@lowerdeck/encryption';
import { env } from './env';

let encryption = env.encryption.SLATES_REGISTRY_ENCRYPTION_KEY
  ? new Encryption(env.encryption.SLATES_REGISTRY_ENCRYPTION_KEY)
  : null;

export let getEncryption = () => {
  if (!encryption) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'SLATES_REGISTRY_ENCRYPTION_KEY must be configured for this operation.'
      })
    );
  }

  return encryption;
};
