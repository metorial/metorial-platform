import { createLock, LockAcquisitionError } from '@lowerdeck/lock';
import { env } from '../env';
import { PublicMcpOAuthError } from './oauthError';

let grantCapacityLock = createLock({
  name: 'sub/pmcp/grant/capacity',
  redisUrl: env.service.REDIS_URL
});

export let withPublicMcpGrantCapacity = async <T>(
  server: { oid: bigint; maxActiveGrants: number | null },
  fn: () => Promise<T>
): Promise<T> => {
  if (!server.maxActiveGrants) return await fn();

  try {
    return await grantCapacityLock.usingLock(server.oid.toString(), async () => await fn());
  } catch (error) {
    if (error instanceof LockAcquisitionError && error.isContention) {
      throw new PublicMcpOAuthError(
        'temporarily_unavailable',
        'This server is busy. Please try again in a moment.',
        { status: 503 }
      );
    }

    throw error;
  }
};
