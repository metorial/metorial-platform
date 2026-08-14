import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { env } from '../../env';
import { remoteOAuthRegistrationService } from '../../services/oauth/remote/registration';

export let discoverRemoteOAuthConnectionQueue = createQueue<{ oauthConnectionId: string }>({
  name: 'shut/rem-oaconn/discover',
  redisUrl: env.service.REDIS_URL
});

export let discoverRemoteOAuthConnectionQueueProcessor =
  discoverRemoteOAuthConnectionQueue.process(async data => {
    let res = await remoteOAuthRegistrationService.runAutoRegistration({
      connectionId: data.oauthConnectionId
    });

    if (res.ok) return;

    if (res.reason == 'not_found') throw new QueueRetryError();
    if (res.reason == 'failed' && res.isTransient) throw new QueueRetryError();
  });
