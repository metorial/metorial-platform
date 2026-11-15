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
}

if (!process.env.SSO_DATABASE_URL) {
  if (
    !process.env.SSO_DATABASE_USERNAME ||
    !process.env.SSO_DATABASE_PASSWORD ||
    !process.env.SSO_DATABASE_HOST ||
    !process.env.SSO_DATABASE_PORT ||
    !process.env.SSO_DATABASE_NAME
  ) {
    throw new Error(
      'SSO_DATABASE_URL is not set and SSO_DATABASE component env vars are missing'
    );
  }

  process.env.SSO_DATABASE_URL = `postgres://${process.env.SSO_DATABASE_USERNAME}:${process.env.SSO_DATABASE_PASSWORD}@${process.env.SSO_DATABASE_HOST}:${process.env.SSO_DATABASE_PORT}/${process.env.SSO_DATABASE_NAME}`;
}

if (!process.env.REDIS_URL) {
  if (!process.env.REDIS_AUTH_TOKEN || !process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    throw new Error('REDIS_URL is not set and redis component env vars are missing');
  }

  process.env.REDIS_URL = `${
    process.env.REDIS_TLS == 'true' ? 'rediss' : 'redis'
  }://:${process.env.REDIS_AUTH_TOKEN}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`;
} else {
  // Ensure Redis URL includes an explicit DB index.
  try {
    let url = new URL(process.env.REDIS_URL);
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/0';
      process.env.REDIS_URL = url.toString();
    }
  } catch {
    // If parsing fails, leave REDIS_URL as-is.
  }
}
