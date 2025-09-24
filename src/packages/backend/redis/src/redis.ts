import { getConfig } from '@metorial/config';
import { memo } from '@metorial/memo';
import { getSentry } from '@metorial/sentry';
import { createClient, RedisClientOptions } from 'redis';
import { parseRedisUrl } from './utils/parseRedisUrl';

let Sentry = getSentry();

export let createRedisClient = (opts: RedisClientOptions & { url?: string | undefined }) => {
  let config = getConfig();
  let url = opts.url ?? config.redisUrl;

  let sanitizedUrl = new URL(url);
  sanitizedUrl.password = '***';

  let parsedUrl = parseRedisUrl(url);

  let connect = async () => {
    let client = createClient({
      database: parsedUrl.db,
      password: parsedUrl.password,

      pingInterval: 3000,
      socket: {
        host: parsedUrl.host,
        port: parsedUrl.port,
        tls: parsedUrl.tls ? true : undefined,

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

    let origSendCommand = client.sendCommand;
    client.sendCommand = function (cmd: any, ...args: any[]) {
      console.log('Redis CMD:', cmd.name, cmd.args);
      try {
        throw new Error('trace');
      } catch (e) {
        console.log(e);
      }
      // @ts-ignore
      return origSendCommand.call(this as any, cmd, ...args);
    } as any;

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
