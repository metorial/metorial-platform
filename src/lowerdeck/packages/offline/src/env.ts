export let OFFLINE_HOST = '127.0.0.1:1';

let OFFLINE_POSTGRES_URL = `postgres://offline:offline@${OFFLINE_HOST}/offline`;
let OFFLINE_REDIS_URL = `redis://${OFFLINE_HOST}`;

let connectionEnv: Record<string, string> = {
  DATABASE_URL: OFFLINE_POSTGRES_URL,
  SUBSPACE_DATABASE_URL: OFFLINE_POSTGRES_URL,
  FEDERATION_DATABASE_URL: OFFLINE_POSTGRES_URL,
  PAYMENT_DATABASE_URL: OFFLINE_POSTGRES_URL,
  GLOBAL_DATABASE_URL: OFFLINE_POSTGRES_URL,
  HYPERPLANE_DATABASE_URL: OFFLINE_POSTGRES_URL,
  REDIS_URL: OFFLINE_REDIS_URL
};

let connectionUrlPattern = /^(postgres(ql)?|mongodb(\+srv)?|rediss?|nats|amqps?|mysql):\/\//i;

export let isOfflinePlaceholderTarget = (target: string) => target.includes(OFFLINE_HOST);

export let installOfflineEnv = () => {
  process.env.LOWERDECK_OFFLINE = '1';

  // Connection strings inherited from the shell would point optional clients (Mongo, NATS,
  // read replicas, ...) at real services, so they're dropped and only placeholders remain.
  for (let [key, value] of Object.entries(process.env)) {
    if (value && connectionUrlPattern.test(value)) delete process.env[key];
  }

  for (let [key, value] of Object.entries(connectionEnv)) process.env[key] = value;

  process.env.METORIAL_ENV ??= 'development';
  process.env.NODE_ENV ??= 'development';
};
