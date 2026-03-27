import { Signer } from '@aws-sdk/rds-signer';
import { PrismaPg } from '@prisma/adapter-pg';
import type pg from 'pg';
import { PrismaClient } from '../../prisma/generated/client.js';
export * from '../../prisma/generated/client.js';

let getGlobalDatabaseRegion = (url: URL) => {
  let arnRegion = process.env.GLOBAL_DATABASE_ARN?.split(':')[3];
  if (arnRegion) return arnRegion;

  let hostParts = url.hostname.split('.');
  let hostRegion = hostParts.length >= 4 ? hostParts[hostParts.length - 4] : undefined;
  if (hostRegion) return hostRegion;

  return process.env.GLOBAL_DB_REGION ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
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
    max: Number.parseInt(url.searchParams.get('connection_limit') || '10', 10)
  };
};

let createClient = () => {
  let mainAdapter =
    process.env.GLOBAL_DATABASE_ARN && process.env.GLOBAL_DATABASE_URL
      ? new PrismaPg(createGlobalDbPoolConfig())
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

  return baseClient;
};

let globalDB: PrismaClient = createClient();

export { globalDB };

export type GlobalDB = typeof globalDB;

declare global {
  namespace PrismaJson {}
}
