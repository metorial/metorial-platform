import { Encryption } from '@lowerdeck/encryption';
import { env } from '../env';

export let outpostKeyEncryption = new Encryption(env.secrets.OUTPOST_KEY_ENCRYPTION_SECRET);
