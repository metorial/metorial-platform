import { createLock } from '@lowerdeck/lock';
import { env } from '../../env';

export let webhookTargetLock = createLock({
  name: 'shub/trg/whk/target/lock',
  redisUrl: env.service.REDIS_URL
});
