import { createApiKeyGenerator } from '@lowerdeck/api-key';
import { createHash } from 'crypto';

export let apiKeys = createApiKeyGenerator(
  { utok: 'user_auth_token', rtok: 'reader_token' },
  { prefix: 'slates' }
);

export let hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex');
