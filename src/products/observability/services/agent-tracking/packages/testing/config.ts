export let unitTestEnv = {
  NODE_ENV: 'test',
  AGENT_TRACKING_HASH_SECRET: 'unit-test-hash-secret',
  DATABASE_URL: 'postgresql://unused:unused@localhost:1/agent-tracking-unit',
  REDIS_URL: 'redis://localhost:1'
};

export let integrationTestEnv = {
  NODE_ENV: 'test',
  AGENT_TRACKING_HASH_SECRET: 'unit-test-hash-secret',
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:35432/agent-tracking-test',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:36379/0',
  AGENT_TRACKING_MONGO_URL:
    process.env.AGENT_TRACKING_MONGO_URL ??
    'mongodb://mongo:mongo@localhost:32707/agent-tracking-test?authSource=admin'
};
