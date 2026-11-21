import { initializeDatabaseUrl } from '@metorial/service-init';

if (!process.env.DATABASE_URL && process.env.AI_GATEWAY_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.AI_GATEWAY_DATABASE_URL;
}

if (!process.env.DATABASE_URL && !process.env.AI_GATEWAY_DATABASE_URL) {
  initializeDatabaseUrl(process.env, {
    prefix: 'DATABASE',
    urlKey: 'DATABASE_URL',
    required: true
  });
}

if (!process.env.AI_GATEWAY_MONGO_URL && process.env.AI_GATEWAY_MONGO_HOST) {
  let encode = (value: string | undefined) => encodeURIComponent(value ?? '');

  // DocumentDB only accepts SCRAM-SHA-1, runs as replica set rs0 and does not support retryable writes.
  process.env.AI_GATEWAY_MONGO_URL = `mongodb://${encode(process.env.AI_GATEWAY_MONGO_USERNAME)}:${encode(process.env.AI_GATEWAY_MONGO_PASSWORD)}@${process.env.AI_GATEWAY_MONGO_HOST}:${process.env.AI_GATEWAY_MONGO_PORT}/${process.env.AI_GATEWAY_MONGO_DATABASE_NAME}?authSource=admin&authMechanism=SCRAM-SHA-1&tls=true&tlsAllowInvalidCertificates=true&replicaSet=rs0&readPreference=primaryPreferred&retryWrites=false`;
}

process.env.AI_GATEWAY_API_PORT ??= '52160';
process.env.AI_GATEWAY_INFERENCE_PORT ??= '52161';
process.env.AI_GATEWAY_HEALTH_PORT ??= '12121';

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
