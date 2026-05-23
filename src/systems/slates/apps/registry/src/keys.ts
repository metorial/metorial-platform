import { createApiKeyGenerator } from '@mtsrc/api-key';

export let apiKeys = createApiKeyGenerator(
  { utok: 'user_auth_token', rtok: 'reader_token' },
  { prefix: 'slates' }
);
