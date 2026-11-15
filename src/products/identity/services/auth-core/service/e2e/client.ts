import { rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { AuthClient } from '@mtsrc/auth-core-api-auth/src/controllers';
import type { InternalClient } from '@mtsrc/auth-core-api-internal';

export let ares = rpc<InternalClient>(
  `${e2eEndpoint('@mtsrc/auth-core-service', 'internal')}/metorial-ares-internal/api`
);

let authEndpoint = `${e2eEndpoint('@mtsrc/auth-core-service', 'auth')}/metorial-ares/auth-api`;

export let anonymousAuth = rpc<AuthClient>(authEndpoint);

export let authWithCookies = (cookies: Record<string, string | undefined>) =>
  rpc<AuthClient>(authEndpoint, {
    headers: {
      cookie: Object.entries(cookies)
        .filter(([, value]) => value)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
    }
  });
