import { Signer } from '@aws-sdk/rds-signer';
import { PrismaPg } from '@prisma/adapter-pg';
import type pg from 'pg';
import { PrismaClient } from '../../prisma/generated/client.js';
import { env } from '../env';
export * from '../../prisma/generated/client.js';

let getPositiveInteger = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value) || value == null || value < 1) {
    return fallback;
  }

  return Math.floor(value);
};

let GLOBAL_DB_TRANSACTION_MAX_WAIT_MS = getPositiveInteger(
  env.service.GLOBAL_DB_TRANSACTION_MAX_WAIT_MS,
  15_000
);

let GLOBAL_DB_TRANSACTION_TIMEOUT_MS = getPositiveInteger(
  env.service.GLOBAL_DB_TRANSACTION_TIMEOUT_MS,
  30_000
);

let GLOBAL_DB_KEEPALIVE_INTERVAL_MS = getPositiveInteger(
  env.service.GLOBAL_DB_KEEPALIVE_INTERVAL_MS,
  30_000
);

let GLOBAL_DB_POOL_IDLE_TIMEOUT_MS = getPositiveInteger(
  env.service.GLOBAL_DB_POOL_IDLE_TIMEOUT_MS,
  5 * 60_000
);

let GLOBAL_DB_CONNECTION_TIMEOUT_MS = getPositiveInteger(
  env.service.GLOBAL_DB_CONNECTION_TIMEOUT_MS,
  10_000
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

let createPoolConfigFromUrl = (url: URL): pg.PoolConfig => {
  let port = Number.parseInt(url.port || '5432', 10);

  return {
    host: url.hostname,
    port: Number.isFinite(port) ? port : 5432,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl:
      url.searchParams.get('sslmode') === 'require'
        ? { rejectUnauthorized: false }
        : undefined,
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
    ...createPoolConfigFromUrl(url),
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
    : new PrismaPg(createPoolConfigFromUrl(url));

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

let keepGlobalDbWarm = async () => {
  try {
    await globalDB.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('Error pinging global database:', error);
  }

  let timeout = setTimeout(() => {
    void keepGlobalDbWarm();
  }, GLOBAL_DB_KEEPALIVE_INTERVAL_MS);

  timeout.unref?.();
};

void keepGlobalDbWarm();

declare global {
  namespace PrismaJson {}
}
