import { Signer } from '@aws-sdk/rds-signer';

export type ServiceEnvironment = Record<string, string | undefined>;

type DatabaseParts = {
  username?: string;
  password?: string;
  host?: string;
  port?: string;
  name?: string;
};

let encode = (value?: string) => encodeURIComponent(value ?? '');

export let buildPostgresUrl = (database: DatabaseParts) =>
  `postgres://${encode(database.username)}:${encode(database.password)}@${database.host}:${database.port}/${database.name}?schema=public&sslmode=no-verify&connection_limit=20`;

export let getReaderHost = (host?: string) => host?.replace('.cluster-', '.cluster-ro-');

let getDatabaseParts = (env: ServiceEnvironment, prefix: string): DatabaseParts => ({
  username: env[`${prefix}_DB_USERNAME`],
  password: env[`${prefix}_DB_PASSWORD`],
  host: env[`${prefix}_DB_HOST`],
  port: env[`${prefix}_DB_PORT`],
  name: env[`${prefix}_DB_NAME`]
});

let setDatabaseUrl = (
  env: ServiceEnvironment,
  prefix: string,
  urlKey: string,
  readerUrlKey: string
) => {
  let database = getDatabaseParts(env, prefix);
  if (!database.host) return;

  env[urlKey] = buildPostgresUrl(database);
  if (env.DATABASE_READER === 'true') {
    env[readerUrlKey] = buildPostgresUrl({
      ...database,
      host: getReaderHost(database.host)
    });
  }
};

let getGlobalDatabaseRegion = (env: ServiceEnvironment, url: URL) => {
  let arnRegion = env.GLOBAL_DATABASE_ARN?.split(':')[3];
  if (arnRegion) return arnRegion;

  let hostParts = url.hostname.split('.');
  let hostRegion = hostParts.length >= 4 ? hostParts[hostParts.length - 4] : undefined;
  if (hostRegion) return hostRegion;

  return env.GLOBAL_DB_REGION ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
};

export let signGlobalDatabaseUrlWithIam = async (
  env: ServiceEnvironment,
  getAuthToken?: (input: {
    region: string;
    hostname: string;
    port: number;
    username: string;
  }) => Promise<string>
) => {
  if (!env.GLOBAL_DATABASE_URL || !env.GLOBAL_DATABASE_ARN) return;

  let url = new URL(env.GLOBAL_DATABASE_URL);
  let region = getGlobalDatabaseRegion(env, url);
  if (!region) throw new Error('AWS region is required to sign GLOBAL_DATABASE_URL');

  let input = {
    region,
    hostname: url.hostname,
    port: Number.parseInt(url.port || '5432', 10),
    username: decodeURIComponent(url.username)
  };
  let token = getAuthToken
    ? await getAuthToken(input)
    : await new Signer(input).getAuthToken();

  if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'no-verify');

  let port = url.port ? `:${url.port}` : '';
  env.GLOBAL_DATABASE_URL = `${url.protocol}//${encode(input.username)}:${encode(token)}@${url.hostname}${port}${url.pathname}${url.search}`;
};

export let initializeRedisUrl = (env: ServiceEnvironment) => {
  if (!env.REDIS_URL && env.REDIS_HOST && env.REDIS_PORT) {
    let protocol = env.REDIS_TLS === 'true' ? 'rediss' : 'redis';
    let credentials = env.REDIS_AUTH_TOKEN ? `:${encode(env.REDIS_AUTH_TOKEN)}@` : '';
    env.REDIS_URL = `${protocol}://${credentials}${env.REDIS_HOST}:${env.REDIS_PORT}/0`;
  }

  if (!env.REDIS_URL) return;

  try {
    let redisUrl = new URL(env.REDIS_URL);
    if (!redisUrl.pathname || redisUrl.pathname === '/') {
      redisUrl.pathname = '/0';
      env.REDIS_URL = redisUrl.toString();
    }
  } catch {
    console.warn('Invalid REDIS_URL; leaving as-is.');
  }
};

export let initializeMetorialServiceEnvironment = async (
  env: ServiceEnvironment = process.env
) => {
  if (!env.DATABASE_URL && env.DATABASE_HOST) {
    let legacyDatabase = {
      username: env.DATABASE_USERNAME,
      password: env.DATABASE_PASSWORD,
      host: env.DATABASE_HOST,
      port: env.DATABASE_PORT,
      name: env.DATABASE_NAME
    };
    env.DATABASE_URL = buildPostgresUrl(legacyDatabase);
    if (env.DATABASE_READER === 'true') {
      env.DATABASE_URL_READER = buildPostgresUrl({
        ...legacyDatabase,
        host: getReaderHost(legacyDatabase.host)
      });
    }
  }

  if (env.AWS_MODE) {
    setDatabaseUrl(
      env,
      'FEDERATION',
      'FEDERATION_CORE_DATABASE_URL',
      'FEDERATION_CORE_DATABASE_URL_READER'
    );
    setDatabaseUrl(env, 'PAYMENT', 'PAYMENT_DATABASE_URL', 'PAYMENT_DATABASE_URL_READER');
    setDatabaseUrl(env, 'CORE', 'DATABASE_URL', 'DATABASE_URL_READER');
    setDatabaseUrl(env, 'SUBSPACE', 'SUBSPACE_DATABASE_URL', 'SUBSPACE_DATABASE_URL_READER');

    if (!env.GLOBAL_DATABASE_URL) {
      setDatabaseUrl(env, 'GLOBAL', 'GLOBAL_DATABASE_URL', 'GLOBAL_DATABASE_URL_READER');
    }
    await signGlobalDatabaseUrlWithIam(env);

    if (env.USAGE_MONGO_HOST) {
      env.USAGE_MONGO_URL = `mongodb://${encode(env.USAGE_MONGO_USERNAME)}:${encode(env.USAGE_MONGO_PASSWORD)}@${env.USAGE_MONGO_HOST}:${env.USAGE_MONGO_PORT}/${env.USAGE_MONGO_DATABASE_NAME}?authSource=admin&authMechanism=SCRAM-SHA-1&tls=true&tlsAllowInvalidCertificates=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`;
    }

    if (env.OPENSEARCH_HOST) {
      env.OPENSEARCH_HOST = `${env.OPENSEARCH_PROTOCOL}://${env.OPENSEARCH_HOST}:${env.OPENSEARCH_PORT}`;
    }
    if (env.MEILISEARCH_HOST) {
      env.MEILISEARCH_HOST = `https://${env.MEILISEARCH_HOST}:${env.MEILISEARCH_PORT}`;
    }
  } else if (!env.SUBSPACE_DATABASE_URL && env.DATABASE_URL) {
    // Standalone OSS Subspace historically receives its own database as DATABASE_URL.
    env.SUBSPACE_DATABASE_URL = env.DATABASE_URL;
  }

  initializeRedisUrl(env);
};
