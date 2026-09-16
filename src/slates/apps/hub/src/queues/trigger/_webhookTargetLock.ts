import { createLock } from '@lowerdeck/lock';
import { env } from '../../env';

// Serializes every status transition of a TriggerWebhookTarget (link, register, unregister).
// The name predates the shared use and is kept so in-flight locks stay compatible.
export let webhookTargetLock = createLock({
  name: 'shub/trg/whk/register/lock',
  redisUrl: env.service.REDIS_URL
});
