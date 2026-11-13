import { Redis } from 'ioredis';
import { env } from '../env';

let client: Redis | undefined;

export let getIdentityRedis = () =>
  (client ??= new Redis(env.service.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true
  }));

export let closeIdentityRedis = async () => {
  if (!client) return;

  let current = client;
  client = undefined;
  await current.quit().catch(() => current.disconnect());
};
