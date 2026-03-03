import { authenticate } from '@metorial/auth';
import { getConfig } from '@metorial/config';
import { AuthInfo } from '@metorial/module-access';
import { RateLimiter, RestServerBuilder } from '@metorial/rest';
import { ApiVersion } from './types';

export let restServer = new RestServerBuilder<AuthInfo, ApiVersion>()
  .authenticate(authenticate)
  .checkCors(
    ({ auth, origin }) =>
      auth.type == 'fine_grained' ||
      auth.machineAccess?.type == 'instance_publishable' ||
      auth.type == 'user'
  )
  .rateLimiter(
    new RateLimiter(
      getConfig().redisUrl,
      ({ auth, context }) =>
        auth.type == 'user'
          ? auth.user.id
          : auth.type == 'fine_grained'
            ? auth.fineGrainedKey.id
          : (auth.machineAccess.organizationOid?.toString() ?? auth.machineAccess.id),

      ({ auth }) => 5000
    )
  )
  .providePresenterContext(c => ({
    apiVersion: c.apiVersion,
    accessType:
      c.type == 'fine_grained' ? 'fine_grained_token' : c.machineAccess?.type ?? 'user_auth_token'
  }))
  .build();
