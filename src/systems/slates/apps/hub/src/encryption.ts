import { Encryption } from '@lowerdeck/encryption';
import { env } from './env';

export let encryption = new Encryption(env.encryption.ENCRYPTION_KEY);
