import Redis from 'ioredis';
import { connect } from 'nats';
import { composeDownQuiet, composeUp, composeDown } from './dockerControl';
import { getTestConnection, isNoDocker } from './connection';
import { sleep } from './poll';

let pingRedis = async (host: string, port: number) => {
  let client = new Redis({
    host,
    port,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    reconnectOnError: () => false
  });
  try {
    await client.connect();
    let pong = await client.ping();
    return pong === 'PONG';
  } finally {
    client.disconnect();
  }
};

let pingNats = async (url: string) => {
  let nc = await connect({ servers: [url], timeout: 1000, reconnect: false });
  await nc.flush();
  await nc.close();
  return true;
};

let waitForReady = async () => {
  let conn = getTestConnection();
  let deadline = Date.now() + 60000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      let [redisOk] = await Promise.all([
        pingRedis(conn.redis.host, conn.redis.port),
        pingNats(conn.natsUrl)
      ]);
      if (redisOk) return;
    } catch (err) {
      lastError = err;
    }
    await sleep(250);
  }

  throw new Error(
    `Redis/NATS not ready within 60s${
      lastError instanceof Error ? `: ${lastError.message}` : ''
    }`
  );
};

export default async function setup() {
  let noDocker = isNoDocker();

  if (!noDocker) {
    // Best-effort clean of any leftovers from a previously aborted run (a stale
    // half-up project can hold the host ports and break `up`).
    composeDownQuiet();
    console.log('[conduit-it] starting Redis + NATS containers...');
    composeUp();
  } else {
    console.log('[conduit-it] CONDUIT_TEST_NO_DOCKER=1, using already-running containers');
  }

  await waitForReady();
  console.log('[conduit-it] Redis + NATS ready');

  return async () => {
    if (!noDocker) {
      console.log('[conduit-it] tearing down containers...');
      composeDown();
    }
  };
}
