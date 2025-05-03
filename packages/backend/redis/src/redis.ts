import { memo } from '@metorial/memo';
import { getSentry } from '@metorial/sentry';
import { createClient, RedisClientOptions } from 'redis';

let Sentry = getSentry();

export let createRedisClient = (opts: RedisClientOptions & { url: string }) => {
  let connect = async () => {
    let client = createClient(opts)
      .on('error', e => {
        console.error(`Redis error for ${opts.url}`);
        console.error(e);
      })
      .on('reconnecting', () => {
        console.log(`Reconnecting to redis: ${opts.url}`);
      });

    try {
      await client.connect();
    } catch (e) {
      Sentry.captureException(e);
      console.error(e);
      console.log(`Could not connect to redis: ${opts.url}`);
      throw e;
    }

    return client;
  };

  return {
    lazy: () => memo(connect),
    eager: async () => await connect()
  };
};
