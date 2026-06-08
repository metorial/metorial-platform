if (!process.env.DATABASE_URL) {
  if (process.env.NEBULA_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.NEBULA_DATABASE_URL;
  } else if (
    process.env.DATABASE_USERNAME &&
    process.env.DATABASE_PASSWORD &&
    process.env.DATABASE_HOST &&
    process.env.DATABASE_PORT &&
    process.env.DATABASE_NAME
  ) {
    process.env.DATABASE_URL = `postgres://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}?schema=public&sslmode=no-verify&connection_limit=20`;

    if (process.env.DATABASE_READER === 'true') {
      process.env.DATABASE_URL_READER = `postgres://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST?.replace('.cluster-', '.cluster-ro-')}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}?schema=public&sslmode=no-verify&connection_limit=20`;
    }
  } else {
    throw new Error('DATABASE_URL is not set and database component env vars are missing');
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
