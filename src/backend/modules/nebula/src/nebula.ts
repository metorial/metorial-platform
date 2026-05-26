import { createRawNebulaClient } from '@metorial-platform-systems/nebula-client';
import { env } from './env';

export let nebula = createRawNebulaClient({
  endpoint: env.nebula.NEBULA_API_URL
});
