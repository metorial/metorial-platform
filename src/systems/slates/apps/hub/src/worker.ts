import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './queues/cron/cleanup';
import { deploymentQueues } from './queues/deployment';
import { discoveryQueues } from './queues/discovery';
import { instanceQueues } from './queues/instance';
import { retentionQueues } from './queues/retention';
import { registryQueues } from './queues/registry';
import { triggerQueues } from './queues/trigger';

await runQueueProcessors([
  registryQueues,
  deploymentQueues,
  discoveryQueues,
  instanceQueues,
  cleanupCron,
  retentionQueues,
  triggerQueues
]);
