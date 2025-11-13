process.env.TZ = 'UTC';
process.env.BOXYHQ_NO_ANALYTICS = '1';
process.env.DO_NOT_TRACK = '1';

if (!process.env.SSO_MONGO_URL && process.env.SSO_MONGO_USERNAME) {
  process.env.SSO_MONGO_URL = `mongodb://${process.env.SSO_MONGO_USERNAME}:${process.env.SSO_MONGO_PASSWORD}@${process.env.SSO_MONGO_HOST}:${process.env.SSO_MONGO_PORT}/${process.env.SSO_MONGO_DATABASE_NAME}?authSource=admin&authMechanism=SCRAM-SHA-1&tls=true&tlsAllowInvalidCertificates=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`;
}

await import('./api');

await import('./internal');

export {};

if (process.env.NODE_ENV === 'production') {
  Bun.serve({
    fetch: (req, server) => {
      return new Response('OK');
    },
    port: 10101
  });
}
