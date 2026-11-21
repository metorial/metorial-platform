import { env } from './env';
import { buildMongoUrl } from '@metorial/service-init';

if (!process.env.DATABASE_URL) {
  if (
    !process.env.DATABASE_USERNAME ||
    !process.env.DATABASE_PASSWORD ||
    !process.env.DATABASE_HOST ||
    !process.env.DATABASE_PORT ||
    !process.env.DATABASE_NAME
  ) {
    throw new Error('DATABASE_URL is not set and database component env vars are missing');
  }

  process.env.DATABASE_URL = `postgres://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}?schema=public&sslmode=no-verify&connection_limit=20`;

  if (process.env.DATABASE_READER === 'true') {
    process.env.DATABASE_URL_READER = `postgres://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST?.replace('.cluster-', '.cluster-ro-')}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}?schema=public&sslmode=no-verify&connection_limit=20`;
  }
}

if (!process.env.REDIS_URL) {
  if (!process.env.REDIS_AUTH_TOKEN || !process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    throw new Error('REDIS_URL is not set and redis component env vars are missing');
  }

  process.env.REDIS_URL = `${
    process.env.REDIS_TLS == 'true' ? 'rediss' : 'redis'
  }://:${process.env.REDIS_AUTH_TOKEN}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`;
} else {
  try {
    const url = new URL(process.env.REDIS_URL);
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/0';
      process.env.REDIS_URL = url.toString();
    }
  } catch {
    // If parsing fails, leave REDIS_URL as-is.
  }
}

if (!process.env.AGENT_TRACKING_MONGO_URL && env.recordStore.host) {
  let { host, port, username, password, database, tlsCaFile } = env.recordStore;

  if (!username || !password || !database) {
    throw new Error(
      'AGENT_TRACKING_MONGO_URL is not set and the AGENT_TRACKING_MONGO_* component env vars are incomplete'
    );
  }

  // Reads stay on the primary: settling and rebuilding read what ingest has just written.
  process.env.AGENT_TRACKING_MONGO_URL = buildMongoUrl({
    host,
    port,
    username,
    password,
    database,
    readPreference: 'primary',
    tlsCAFile: tlsCaFile
  });
}
