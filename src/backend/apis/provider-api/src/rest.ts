import { authenticate } from '@metorial/auth';
import { getConfig } from '@metorial/config';
import { AuthInfo } from '@metorial/module-access';
import { PresenterContext } from '@metorial/presenter';
import { RateLimiter, RestServerBuilder } from '@metorial/rest';
import { ProviderApiVersion } from './types';

export let restServer = new RestServerBuilder<AuthInfo, ProviderApiVersion>()
  .authenticate(authenticate)
  .checkCors(({ auth }) => auth.type === 'machine')
  .rateLimiter(
    new RateLimiter(
      getConfig().redisUrl,
      ({ auth }) =>
        auth.type === 'user'
          ? auth.user.id
          : (auth.machineAccess.organizationOid?.toString() ?? auth.machineAccess.id),
      ({ auth }) => 5000
    )
  )
  .providePresenterContext(
    (): PresenterContext => ({
      // Provider API uses a single version, map to a compatible PresenterContext
      apiVersion: 'mt_2025_01_01_magnetar',
      accessType: 'instance_secret'
    })
  )
  .build();
