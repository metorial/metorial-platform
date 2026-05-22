import { workerHealthFetch } from './health';

if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') {
  Bun.serve({
    fetch: workerHealthFetch,
    port: Number(process.env.WORKER_HEALTH_PORT ?? 12121)
  });
}
