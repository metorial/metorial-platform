import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { OAuthUtils } from '../../lib/oauth/oauthUtils';
import { remoteOAuthDiscoveryService } from '../../services';

export let discoverRemoteOAuthConfigQueue = createQueue<{ oauthConfigId: string }>({
  name: 'shut/rem-oaconf/discover',
  redisUrl: env.service.REDIS_URL
});

export let discoverRemoteOAuthConfigQueueProcessor = discoverRemoteOAuthConfigQueue.process(
  async data => {
    let oauthConfig = await db.remoteOAuthConfig.findFirst({
      where: { id: data.oauthConfigId }
    });
    if (!oauthConfig) throw new QueueRetryError();

    try {
      let discovery = await remoteOAuthDiscoveryService.discoverOauthConfigWithoutRegistration(
        { discoveryUrl: oauthConfig.discoveryUrl! }
      );

      await db.remoteOAuthConfig.update({
        where: { oid: oauthConfig.oid },
        data: {
          discoverStatus: OAuthUtils.supportsAuthRegistration(discovery.config)
            ? ('supports_auto_registration' as const)
            : ('manual' as const),
          providerName: discovery.providerName,
          providerUrl: discovery.providerUrl,
          oauthDiscoveryDocumentOid: discovery.oid,
          config: discovery.config,
          lastDiscoveredAt: new Date(),
          errorCode: null,
          errorMessage: null
        }
      });
    } catch (e) {
      await db.remoteOAuthConfig.update({
        where: { id: oauthConfig.id },
        data: {
          discoverStatus: oauthConfig.discoverStatus == 'discovering' ? 'failed' : undefined,
          lastDiscoveredAt: new Date(),
          errorCode: 'discovery_failed',
          errorMessage: `Failed to discover OAuth configuration from ${oauthConfig.discoveryUrl}`
        }
      });
    }
  }
);
