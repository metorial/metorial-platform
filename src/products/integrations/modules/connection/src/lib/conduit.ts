import { createConduit, createRedisNatsConduit } from '@metorial-subspace/conduit';
import { parseRedisUrl } from '@metorial-subspace/redis-url';
import { env } from '../env';

export let conduit = createConduit(
  createRedisNatsConduit({
    conduitId: 'subspace-connection',
    redisConfig: parseRedisUrl(env.service.REDIS_URL),
    natsConfig: {
      servers: env.service.NATS_URL.split(',')
        .map(s => s.trim())
        .filter(Boolean)
    }
  })
);
