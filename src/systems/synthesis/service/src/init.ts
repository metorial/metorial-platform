if (!process.env.DATABASE_URL && process.env.SYNTHESIS_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.SYNTHESIS_DATABASE_URL;
}

if (!process.env.DATABASE_URL && !process.env.SYNTHESIS_DATABASE_URL) {
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
}

process.env.SYNTHESIS_API_PORT ??= '52160';
process.env.SYNTHESIS_HEALTH_PORT ??= '12121';

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
    // Leave REDIS_URL unchanged if parsing fails.
  }
}
