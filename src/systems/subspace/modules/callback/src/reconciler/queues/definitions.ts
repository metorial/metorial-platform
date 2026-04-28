import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let callbackReconcileInstanceQueue = createQueue<{
  callbackInstanceId: string;
}>({
  name: 'sub/callback/reconcile/instance',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 20,
    limiter: {
      max: 20,
      duration: 1000
    }
  }
});

export let callbackReconcileInstancesPageQueue = createQueue<{
  callbackId: string;
  cursor?: string;
}>({
  name: 'sub/callback/reconcile/instances/page',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

export let callbackV2MigrationScanQueue = createQueue<{
  cursor?: string;
}>({
  name: 'sub/callback/v2-migration/scan',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

export let callbackV2MigrationCallbackQueue = createQueue<{
  callbackId: string;
}>({
  name: 'sub/callback/v2-migration/callback',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000
    }
  }
});
