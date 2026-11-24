import { initializeDatabaseUrl } from '@metorial/service-init';

if (!process.env.DATABASE_URL) {
  if (process.env.NEBULA_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.NEBULA_DATABASE_URL;
  } else {
    initializeDatabaseUrl(process.env, {
      prefix: 'DATABASE',
      urlKey: 'DATABASE_URL',
      required: true
    });
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
    let url = new URL(process.env.REDIS_URL);
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/0';
      process.env.REDIS_URL = url.toString();
    }
  } catch {
    // Leave REDIS_URL as-is if parsing fails.
  }
}
