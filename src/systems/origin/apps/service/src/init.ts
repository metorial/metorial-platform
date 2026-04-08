if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `postgres://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}?schema=public&sslmode=no-verify&connection_limit=20`;
}

if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = `${process.env.REDIS_TLS == 'true' ? 'rediss' : 'redis'}://:${process.env.REDIS_AUTH_TOKEN}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`;
} else {
  try {
    let redisUrl = new URL(process.env.REDIS_URL);

    if (!redisUrl.pathname || redisUrl.pathname === '/') {
      redisUrl.pathname = '/0';
      process.env.REDIS_URL = redisUrl.toString();
    }
  } catch (error) {
    console.warn('Invalid REDIS_URL; leaving as-is.');
  }
}
