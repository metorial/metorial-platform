import { createQueue } from '@lowerdeck/queue';
import { callbackRegistrationReconcileQueue as callbackReconcileQueue } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/deploymentConfigPair';
import { env } from '../../env';

export { callbackReconcileQueue };

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

export let callbackReconcileRegistrationsPageQueue = createQueue<{
  callbackId: string;
  cursor?: string;
}>({
  name: 'sub/callback/reconcile/registrations/page',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

export let callbackReconcileRegistrationAuditQueue = createQueue<{
  registrationId: string;
}>({
  name: 'sub/callback/reconcile/registration/audit',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 20,
      duration: 1000
    }
  }
});
