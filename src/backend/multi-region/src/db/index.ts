import { Signer } from '@aws-sdk/rds-signer';
import { delay } from '@lowerdeck/delay';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../../prisma/generated/client.js';
export * from '../../prisma/generated/client.js';

let { Pool } = pg;

let getGlobalDatabaseRegion = (url: URL) => {
  let arnRegion = process.env.GLOBAL_DATABASE_ARN?.split(':')[3];
  if (arnRegion) return arnRegion;

  let hostParts = url.hostname.split('.');
  let hostRegion = hostParts.length >= 4 ? hostParts[hostParts.length - 4] : undefined;
  if (hostRegion) return hostRegion;

  return (
    process.env.GLOBAL_DB_REGION ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
  );
};

let getGlobalDbPoolSize = (url: URL) => {
  let rawPoolSize =
    process.env.GLOBAL_DATABASE_POOL_SIZE ?? url.searchParams.get('connection_limit') ?? '10';
  let poolSize = Number.parseInt(rawPoolSize, 10);

  if (!Number.isFinite(poolSize) || poolSize < 1) {
    throw new Error('GLOBAL_DATABASE_POOL_SIZE must be a positive integer');
  }

  return poolSize;
};

let getGlobalDbPingIntervalMs = () => {
  let rawPingInterval = process.env.GLOBAL_DATABASE_PING_INTERVAL_MS ?? '10000';
  let pingInterval = Number.parseInt(rawPingInterval, 10);

  if (!Number.isFinite(pingInterval) || pingInterval < 1000) {
    throw new Error('GLOBAL_DATABASE_PING_INTERVAL_MS must be at least 1000');
  }

  return pingInterval;
};

let createGlobalDbPoolConfig = (): pg.PoolConfig => {
  if (!process.env.GLOBAL_DATABASE_URL) {
    throw new Error('GLOBAL_DATABASE_URL is required');
  }

  let url = new URL(process.env.GLOBAL_DATABASE_URL);
  let region = getGlobalDatabaseRegion(url);

  if (!region) {
    throw new Error('AWS region is required for GLOBAL_DATABASE_URL');
  }

  let username = decodeURIComponent(url.username);
  let port = Number.parseInt(url.port || '5432', 10);
  let poolSize = getGlobalDbPoolSize(url);
  let signer = new Signer({
    region,
    hostname: url.hostname,
    port,
    username
  });

  return {
    host: url.hostname,
    port,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    user: username,
    password: async () => await signer.getAuthToken(),
    ssl:
      url.searchParams.get('sslmode') === 'require'
        ? { rejectUnauthorized: false }
        : undefined,
    min: poolSize,
    max: poolSize,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  };
};

let createGlobalDbPool = () => {
  let pool = new Pool(createGlobalDbPoolConfig());

  pool.on('error', error => {
    console.error('Error from idle global database connection:', error);
  });

  return pool;
};

let warmGlobalDbPool = async (pool: pg.Pool, size: number) => {
  let clients: { client: pg.PoolClient; released: boolean }[] = [];

  try {
    for (let index = 0; index < size; index++) {
      let client = await pool.connect();
      clients.push({ client, released: false });
    }

    await Promise.all(
      clients.map(async entry => {
        try {
          await entry.client.query('SELECT 1');
        } catch (error) {
          entry.released = true;
          entry.client.release(true);
          throw error;
        }
      })
    );
  } finally {
    for (let entry of clients) {
      if (entry.released) continue;
      entry.released = true;
      entry.client.release();
    }
  }
};

let maintainGlobalDbPool = (pool: pg.Pool) => {
  let targetSize = pool.options.max;
  let pingInterval = getGlobalDbPingIntervalMs();

  if (!targetSize || targetSize < 1) return;

  void (async () => {
    while (true) {
      try {
        await warmGlobalDbPool(pool, targetSize);
      } catch (error) {
        console.error('Error warming global database pool:', error);
      }

      await delay(pingInterval);
    }
  })();
};

let createClient = () => {
  let globalDbPool =
    process.env.GLOBAL_DATABASE_ARN && process.env.GLOBAL_DATABASE_URL
      ? createGlobalDbPool()
      : undefined;

  let mainAdapter = globalDbPool
    ? new PrismaPg(globalDbPool)
    : new PrismaPg({
        connectionString: process.env.GLOBAL_DATABASE_URL
      });

  let baseClient = new PrismaClient({
    adapter: mainAdapter,
    transactionOptions: {
      maxWait: 10000,
      timeout: 12000
    }
  });

  if (globalDbPool) {
    maintainGlobalDbPool(globalDbPool);
  }

  return baseClient;
};

let globalDB: PrismaClient = createClient();

export { globalDB };

export type GlobalDB = typeof globalDB;

declare global {
  namespace PrismaJson {}
}
