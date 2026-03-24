import { createQueue } from '@lowerdeck/queue';
import { env } from '../../../../agent/src/env';
import { indexAgentQueue } from '../search/agent';
import { lcOpts } from './_opts';

export let agentCreatedQueue = createQueue<{ agentId: string }>({
  name: 'sub/idn/lc/agent/created',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let agentCreatedQueueProcessor = agentCreatedQueue.process(async data => {
  await indexAgentQueue.add({ agentId: data.agentId });
});

export let agentUpdatedQueue = createQueue<{ agentId: string }>({
  name: 'sub/idn/lc/agent/updated',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let agentUpdatedQueueProcessor = agentUpdatedQueue.process(async data => {
  await indexAgentQueue.add({ agentId: data.agentId });
});

export let agentDeletedQueue = createQueue<{ agentId: string }>({
  name: 'sub/idn/lc/agent/deleted',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let agentDeletedQueueProcessor = agentDeletedQueue.process(async data => {
  await indexAgentQueue.add({ agentId: data.agentId });
});
