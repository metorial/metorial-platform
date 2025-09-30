import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { providerOauthDiscoveryService } from '../services';
import { OAuthConfiguration } from '../types';

export let asyncAutoDiscoveryQueue = createQueue<{ connectionId: string }>({
  name: 'oat/asyncadic',
  workerOpts: { concurrency: 10, limiter: { max: 25, duration: 1000 } },
  jobOpts: {
    attempts: 25,
    backoff: { type: 'exponential', delay: 1000 }
  }
});

export let asyncAutoDiscoveryQueueProcessor = asyncAutoDiscoveryQueue.process(async data => {
  let connection = await db.providerOAuthConnection.findUnique({
    where: { id: data.connectionId },
    include: { config: true, instance: { include: { organization: true } } }
  });
  if (!connection) throw new Error('retry ... not found');
  if (!connection.isAutoDiscoveryActive) return;

  let autoReg = await providerOauthDiscoveryService.autoRegisterForOauthConfig({
    config: connection.config.config as OAuthConfiguration,
    clientName: connection.instance.organization.name
  });
  if (!autoReg && !connection.clientId) {
    await db.providerOAuthConnection.update({
      where: { id: connection.id },
      data: {
        status: 'failed',
        isAutoDiscoveryActive: false,
        failureCode: 'auto_registration_unsupported',
        failureMessage: 'Provider does not support auto registration'
      }
    });

    await db.serverDeployment.updateMany({
      where: {
        oauthConnectionOid: connection.oid
      },
      data: {
        status: 'failed',
        failureCode: 'oauth_connection_setup_failed',
        failureMessage:
          'OAuth connection setup failed due to provider not supporting auto registration'
      }
    });

    return;
  }

  await db.providerOAuthConnection.update({
    where: { id: connection.id },
    data: {
      registrationOid: autoReg?.oid,
      isAutoDiscoveryActive: false,
      status: 'active',
      failureCode: null,
      failureMessage: null,
      clientId: autoReg?.clientId ?? undefined,
      clientSecret: autoReg?.clientSecret ?? undefined
    }
  });
});
