import { authenticate } from '@metorial/auth';
import { getConfig } from '@metorial/config';
import { AuthInfo } from '@metorial/module-access';
import { RateLimiter, RestServerBuilder } from '@metorial/rest';
import { ApiVersion } from './types';

export let restServer = new RestServerBuilder<AuthInfo, ApiVersion>()
  .authenticate(authenticate)
  .checkCors(
    ({ auth, origin }) =>
      auth.machineAccess?.type == 'instance_publishable' ||
      (auth.type == 'user' &&
        (getConfig().env == 'development' ||
          ['metorial.com', 'metorial-staging.click'].some(domain => origin.includes(domain))))
  )
  .rateLimiter(
    new RateLimiter(
      getConfig().redisUrl,
      ({ auth, context }) =>
        auth.type == 'user'
          ? auth.user.id
          : (auth.machineAccess.organizationOid?.toString() ?? auth.machineAccess.id),

      ({ auth }) => 5000
    )
  )
  .providePresenterContext(c => ({
    apiVersion: c.apiVersion,
    accessType: c.machineAccess?.type ?? 'user_auth_token'
  }))
  .build();
