import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface TestConnection {
  redis: { host: string; port: number };
  natsUrl: string;
  natsHttpPort: number;
}

export let getTestConnection = (): TestConnection => {
  let host = process.env.CONDUIT_TEST_REDIS_HOST ?? '127.0.0.1';
  let redisPort = Number(process.env.CONDUIT_TEST_REDIS_PORT ?? 56390);
  let natsPort = Number(process.env.CONDUIT_TEST_NATS_PORT ?? 56290);
  let natsHttpPort = Number(process.env.CONDUIT_TEST_NATS_HTTP_PORT ?? 56291);
  let natsUrl = process.env.CONDUIT_TEST_NATS_URL ?? `nats://${host}:${natsPort}`;

  return {
    redis: { host, port: redisPort },
    natsUrl,
    natsHttpPort
  };
};

let here = dirname(fileURLToPath(import.meta.url));

export let COMPOSE_PROJECT = 'conduit-it';
export let COMPOSE_FILE = join(here, '..', 'docker-compose.yml');

export let isNoDocker = () => process.env.CONDUIT_TEST_NO_DOCKER === '1';
