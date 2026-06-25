if (!process.env.DATABASE_URL && !process.env.CARGO_DATABASE_URL) {
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

process.env.CARGO_API_PORT ??= '52150';
process.env.CARGO_CONTENT_PORT ??= '52151';
process.env.CARGO_HEALTH_PORT ??= '12121';

export {};
