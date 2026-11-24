import { initializeDatabaseUrl } from '@metorial/service-init';

if (!process.env.DATABASE_URL) {
  initializeDatabaseUrl(process.env, { prefix: 'DATABASE', urlKey: 'DATABASE_URL' });
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

// Backwards compat: some setups still use LAMBDA_ROLE_ARN.
if (!process.env.LAMBDA_EXECUTION_ROLE_ARN && process.env.LAMBDA_ROLE_ARN) {
  process.env.LAMBDA_EXECUTION_ROLE_ARN = process.env.LAMBDA_ROLE_ARN;
}
