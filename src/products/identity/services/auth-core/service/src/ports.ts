import { env } from './env';

export let aresPorts = {
  auth: env.service.ARES_AUTH_PORT ?? 52120,
  admin: env.service.ARES_ADMIN_PORT ?? 52121,
  sso: env.service.ARES_SSO_PORT ?? 52122,
  internal: env.service.ARES_INTERNAL_PORT ?? 52123,
  health: 12121
} as const;
