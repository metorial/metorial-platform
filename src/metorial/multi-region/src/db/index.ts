import { Signer } from '@aws-sdk/rds-signer';
import { delay } from '@lowerdeck/delay';
import { PrismaPg } from '@prisma/adapter-pg';
import type pg from 'pg';
import { PrismaClient } from '../../prisma/generated/client.js';
export * from '../../prisma/generated/client.js';

let getPositiveInteger = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value) || value == null || value < 1) {
    return fallback;
  }

  return Math.floor(value);
};

let GLOBAL_DB_TRANSACTION_MAX_WAIT_MS = getPositiveInteger(
  Number(process.env.GLOBAL_DB_TRANSACTION_MAX_WAIT_MS),
  15_000
);

let GLOBAL_DB_TRANSACTION_TIMEOUT_MS = getPositiveInteger(
  Number(process.env.GLOBAL_DB_TRANSACTION_TIMEOUT_MS),
  30_000
);

let GLOBAL_DB_KEEPALIVE_INTERVAL_MS = getPositiveInteger(
  Number(process.env.GLOBAL_DB_KEEPALIVE_INTERVAL_MS),
  30_000
);

let GLOBAL_DB_POOL_IDLE_TIMEOUT_MS = getPositiveInteger(
  Number(process.env.GLOBAL_DB_POOL_IDLE_TIMEOUT_MS),
  5 * 60_000
);

let GLOBAL_DB_CONNECTION_TIMEOUT_MS = getPositiveInteger(
  Number(process.env.GLOBAL_DB_CONNECTION_TIMEOUT_MS),
  10_000
);

let GLOBAL_DB_READY_MAX_ATTEMPTS = getPositiveInteger(
  env.service.GLOBAL_DB_READY_MAX_ATTEMPTS,
  6
);

let GLOBAL_DB_READY_RETRY_BASE_MS = getPositiveInteger(
  env.service.GLOBAL_DB_READY_RETRY_BASE_MS,
  250
);

let GLOBAL_DB_READY_RETRY_MAX_MS = getPositiveInteger(
  env.service.GLOBAL_DB_READY_RETRY_MAX_MS,
  5_000
);

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

let createBasePoolConfigFromUrl = (url: URL): pg.PoolConfig => {
  return {
    max: getPositiveInteger(
      Number.parseInt(url.searchParams.get('connection_limit') || '10', 10),
      10
    ),
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
    idleTimeoutMillis: GLOBAL_DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: GLOBAL_DB_CONNECTION_TIMEOUT_MS
  };
};

let createStaticPasswordPoolConfigFromUrl = (url: URL): pg.PoolConfig => {
  return {
    ...createBasePoolConfigFromUrl(url),
    connectionString: url.toString()
  };
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

  let signer = new Signer({
    region,
    hostname: url.hostname,
    port: Number.parseInt(url.port || '5432', 10),
    username: decodeURIComponent(url.username)
  });

  return {
    ...createBasePoolConfigFromUrl(url),
    host: url.hostname,
    port: Number.parseInt(url.port || '5432', 10),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    user: decodeURIComponent(url.username),
    ssl:
      url.searchParams.get('sslmode') === 'require' ||
      url.searchParams.get('sslmode') === 'no-verify'
        ? { rejectUnauthorized: false }
        : undefined,
    password: async () => await signer.getAuthToken()
  };
};

let createClient = () => {
  if (!process.env.GLOBAL_DATABASE_URL) {
    throw new Error('GLOBAL_DATABASE_URL is required');
  }

  let url = new URL(process.env.GLOBAL_DATABASE_URL);
  let mainAdapter = process.env.GLOBAL_DATABASE_ARN
    ? new PrismaPg(createGlobalDbPoolConfig())
    : new PrismaPg(createStaticPasswordPoolConfigFromUrl(url));

  let baseClient = new PrismaClient({
    adapter: mainAdapter,
    transactionOptions: {
      maxWait: GLOBAL_DB_TRANSACTION_MAX_WAIT_MS,
      timeout: GLOBAL_DB_TRANSACTION_TIMEOUT_MS
    }
  });

  return baseClient;
};

let globalDB: PrismaClient = createClient();

export { globalDB };

export type GlobalDB = typeof globalDB;

let globalDatabaseReadyPromise: Promise<void> | null = null;
let globalDatabaseKeepaliveStarted = false;
let globalDatabaseKeepaliveTimer: ReturnType<typeof setTimeout> | null = null;

let getReadyRetryDelay = (attempt: number) => {
  let exponentialDelay = Math.min(
    GLOBAL_DB_READY_RETRY_BASE_MS * Math.pow(2, attempt - 1),
    GLOBAL_DB_READY_RETRY_MAX_MS
  );
  let jitter = Math.floor(Math.random() * Math.max(1, exponentialDelay * 0.2));

  return exponentialDelay + jitter;
};

let keepGlobalDbWarm = async () => {
  try {
    await globalDB.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('Error pinging global database:', error);
  }

  globalDatabaseKeepaliveTimer = setTimeout(() => {
    void keepGlobalDbWarm();
  }, GLOBAL_DB_KEEPALIVE_INTERVAL_MS);

  globalDatabaseKeepaliveTimer.unref?.();
};

export let startGlobalDatabaseKeepalive = () => {
  if (globalDatabaseKeepaliveStarted) return;
  globalDatabaseKeepaliveStarted = true;

  globalDatabaseKeepaliveTimer = setTimeout(() => {
    void keepGlobalDbWarm();
  }, GLOBAL_DB_KEEPALIVE_INTERVAL_MS);
  globalDatabaseKeepaliveTimer.unref?.();
};

export let stopGlobalDatabaseKeepalive = () => {
  if (globalDatabaseKeepaliveTimer) clearTimeout(globalDatabaseKeepaliveTimer);
  globalDatabaseKeepaliveTimer = null;
  globalDatabaseKeepaliveStarted = false;
};

export let ensureGlobalDatabaseReady = () => {
  if (globalDatabaseReadyPromise) return globalDatabaseReadyPromise;

  let readiness = (async () => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= GLOBAL_DB_READY_MAX_ATTEMPTS; attempt++) {
      try {
        await globalDB.$queryRaw`SELECT 1`;
        startGlobalDatabaseKeepalive();
        return;
      } catch (error) {
        lastError = error;

        if (attempt >= GLOBAL_DB_READY_MAX_ATTEMPTS) break;

        let retryDelay = getReadyRetryDelay(attempt);
        console.warn(
          `Global database connection attempt ${attempt}/${GLOBAL_DB_READY_MAX_ATTEMPTS} failed; retrying in ${retryDelay}ms`
        );
        await delay(retryDelay);
      }
    }

    throw new Error(
      `Global database was not ready after ${GLOBAL_DB_READY_MAX_ATTEMPTS} attempts`,
      { cause: lastError }
    );
  })();

  globalDatabaseReadyPromise = readiness.catch(error => {
    globalDatabaseReadyPromise = null;
    throw error;
  });

  return globalDatabaseReadyPromise;
};

declare global {
  namespace PrismaJson {}
}
