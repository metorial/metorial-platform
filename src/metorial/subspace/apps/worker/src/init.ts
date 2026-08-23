import { initializeMetorialServiceEnvironment } from '@metorial/service-init';

await initializeMetorialServiceEnvironment();

let { initializeSnowflakeWorkerLease } = await import('@metorial-subspace/db');
await initializeSnowflakeWorkerLease({ redisUrl: process.env.REDIS_URL });
