import { getConfig } from '@metorial/config';
import { memo } from '@metorial/memo';
import { getSentry } from '@metorial/sentry';
import { createClient, RedisClientOptions } from 'redis';

let Sentry = getSentry();

export let createRedisClient = (opts: RedisClientOptions & { url: string | undefined }) => {
  let config = getConfig();
  let url = opts.url ?? config.redisUrl;

  let sanitizedUrl = new URL(url);
  sanitizedUrl.password = '***';

  let connect = async () => {
    let client = createClient({
      ...opts,
      pingInterval: 10000,
      socket: {
        reconnectStrategy: retries => {
          console.log(`Checking redis reconnection: ${sanitizedUrl}`);

          const jitter = Math.floor(Math.random() * 200);
          const delay = Math.min(Math.pow(2, retries) * 50, 2000);

          return delay + jitter;
        }
      }
    })
      .on('error', e => {
        console.error(`Redis error for ${sanitizedUrl}`);
        console.error(e);
      })
      .on('reconnecting', () => {
        console.log(`Reconnecting to redis: ${sanitizedUrl}`);
      });

    try {
      await client.connect();
    } catch (e) {
      Sentry.captureException(e);
      console.error(e);
      console.log(`Could not connect to redis: ${url}`);
      throw e;
    }

    return client;
  };

  return {
    lazy: () => memo(connect),
    eager: async () => await connect()
  };
};
