import { createSsoClient } from '@metorial/services-sso/client';
import { env } from './env';

export let sso = createSsoClient(env.sso.SSO_SERVICE_RPC_URL);
