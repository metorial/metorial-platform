import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { OAuthUtils } from '../../lib/oauth/oauthUtils';

export let discoverRemoteOAuthConnectionQueue = createQueue<{ oauthConnectionId: string }>({
  name: 'shut/rem-oaconn/discover',
  redisUrl: env.service.REDIS_URL
});

export let discoverRemoteOAuthConnectionQueueProcessor =
  discoverRemoteOAuthConnectionQueue.process(async data => {
    let oauthConnection = await db.remoteOAuthConnection.findFirst({
      where: { id: data.oauthConnectionId },
      include: { config: true, tenant: true }
    });
    if (!oauthConnection) throw new QueueRetryError();

    if (oauthConnection.discoveryStatus == 'succeeded') return;

    if (await OAuthUtils.supportsAuthRegistration(oauthConnection.config.config)) {
      let reg = await OAuthUtils.registerClient({
        tenant: oauthConnection.tenant,
        config: oauthConnection.config.config,
        owner: {
          config: oauthConnection.config,
          connection: oauthConnection
        }
      });

      if (reg?.ok) {
        await db.remoteOAuthConnection.update({
          where: { id: oauthConnection.id },
          data: {
            registrationOid: reg.registration.oid,
            clientId: reg.registration.clientId,
            discoveryStatus: 'succeeded'
          }
        });

        await db.remoteOAuthConnectionEvent.create({
          data: {
            ...getId('remoteOAuthConnectionEvent'),
            connectionOid: oauthConnection.oid,
            type: 'auto_registration_succeeded',
            metadata: {
              clientId: reg.registration.clientId
            }
          }
        });
      } else {
        let inner = (reg?.error.payload as any)?.error || 'unknown_error';

        await db.remoteOAuthConnection.update({
          where: { id: oauthConnection.id },
          data: {
            discoveryStatus: 'failed',
            errorCode: 'auto_registration_failed',
            errorMessage: `Failed to auto-register OAuth client for connection: ${inner}`
          }
        });

        await db.remoteOAuthConnectionEvent.create({
          data: {
            ...getId('remoteOAuthConnectionEvent'),
            connectionOid: oauthConnection.oid,
            type: 'auto_registration_failed',
            metadata: {
              error: inner
            }
          }
        });
      }
    } else {
      await db.remoteOAuthConnection.update({
        where: { id: oauthConnection.id },
        data: {
          discoveryStatus: 'failed',
          errorCode: 'auto_registration_unsupported',
          errorMessage: `OAuth provider does not support auto-registration.`
        }
      });
    }
  });
