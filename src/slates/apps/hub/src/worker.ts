import { runQueueProcessors } from '@lowerdeck/queue';
import { attachmentQueues } from './queues/attachment';
import { cleanupCron } from './queues/cron/cleanup';
import { deploymentQueues } from './queues/deployment';
import { discoveryQueues } from './queues/discovery';
import { errorQueues } from './queues/error';
import { instanceQueues } from './queues/instance';
import { reconcileEventIdsQueue } from './queues/instance/reconcileEventIds';
import { registryQueues } from './queues/registry';
import { retentionQueues } from './queues/retention';
import { triggerQueues } from './queues/trigger';
import { webhookQueues } from './queues/webhook';

await reconcileEventIdsQueue.add({});

await runQueueProcessors([
  attachmentQueues,
  errorQueues,
  registryQueues,
  deploymentQueues,
  discoveryQueues,
  instanceQueues,
  cleanupCron,
  retentionQueues,
  webhookQueues,
  triggerQueues
]);
