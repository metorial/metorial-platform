import { getConfig } from '@metorial/config';
import { memo } from '@metorial/memo';
import { getSentry } from '@metorial/sentry';
import { createClient, RedisClientOptions } from 'redis';

let Sentry = getSentry();

export let createRedisClient = (opts: RedisClientOptions & { url: string | undefined }) => {
  let config = getConfig();
  let url = opts.url ?? config.redisUrl;

  let connect = async () => {
    let client = createClient(opts)
      .on('error', e => {
        console.error(`Redis error for ${url}`);
        console.error(e);
      })
      .on('reconnecting', () => {
        console.log(`Reconnecting to redis: ${url}`);
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
