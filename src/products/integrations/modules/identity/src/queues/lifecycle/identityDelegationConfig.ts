import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexIdentityDelegationConfigQueue } from '../search/identityDelegationConfig';
import { lcOpts } from './_opts';

export let identityDelegationConfigCreatedQueue = createQueue<{
  identityDelegationConfigId: string;
}>({
  name: 'sub/idn/lc/identityDelegationConfig/created',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityDelegationConfigCreatedQueueProcessor =
  identityDelegationConfigCreatedQueue.process(async data => {
    await indexIdentityDelegationConfigQueue.add({
      identityDelegationConfigId: data.identityDelegationConfigId
    });
  });

export let identityDelegationConfigUpdatedQueue = createQueue<{
  identityDelegationConfigId: string;
}>({
  name: 'sub/idn/lc/identityDelegationConfig/updated',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityDelegationConfigUpdatedQueueProcessor =
  identityDelegationConfigUpdatedQueue.process(async data => {
    await indexIdentityDelegationConfigQueue.add({
      identityDelegationConfigId: data.identityDelegationConfigId
    });
  });

export let identityDelegationConfigDeletedQueue = createQueue<{
  identityDelegationConfigId: string;
}>({
  name: 'sub/idn/lc/identityDelegationConfig/deleted',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityDelegationConfigDeletedQueueProcessor =
  identityDelegationConfigDeletedQueue.process(async data => {
    await indexIdentityDelegationConfigQueue.add({
      identityDelegationConfigId: data.identityDelegationConfigId
    });
  });
