import { Encryption } from '@mtsrc/encryption';
import { env } from './env';

export let encryption = new Encryption(env.encryption.ENCRYPTION_KEY);
