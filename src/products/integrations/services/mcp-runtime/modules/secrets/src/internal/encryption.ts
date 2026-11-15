import { Encryption } from '@lowerdeck/encryption';
import { env } from '@mtsrc/mcp-runtime-env';

export let encryption = new Encryption(env.encryption.ENCRYPTION_KEY);
