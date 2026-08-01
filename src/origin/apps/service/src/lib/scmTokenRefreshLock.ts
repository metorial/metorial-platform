import { createLock } from '@lowerdeck/lock';
import { env } from '../env';

let scmTokenRefreshLock = createLock({
  name: 'origin/scm/token-refresh',
  redisUrl: env.service.REDIS_URL
});

export let usingScmTokenRefreshLock = <T>(
  provider: 'gitlab' | 'bitbucket',
  installationOid: bigint,
  fn: () => Promise<T>
) =>
  scmTokenRefreshLock.usingLock(
    `${provider}:${installationOid.toString()}`,
    async () => await fn()
  );
