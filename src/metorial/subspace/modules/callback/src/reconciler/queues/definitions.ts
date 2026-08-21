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

export let reconcileCallbackRegistrationQueue = createQueue<{
  callbackInstanceId: string;
}>({
  name: 'sub/callback/registration/reconcile',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 20 }
});

export let repairCallbackRegistrationsQueue = createQueue<{
  cursor?: string;
}>({
  name: 'sub/callback/registration/repair',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});
