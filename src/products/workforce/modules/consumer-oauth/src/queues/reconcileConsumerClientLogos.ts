import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { webDiscoveryService } from '@metorial/module-web';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import { getConsumerClientLogoDiscoveryUrl } from '../lib/logoDiscoveryUrl';

let LOGO_RECONCILE_BATCH_SIZE = 500;
let LOGO_POLL_MAX_ATTEMPTS = 12;
let LOGO_POLL_BASE_DELAY_MS = 5_000;
let LOGO_POLL_MAX_DELAY_MS = 60_000;

export let reconcileConsumerClientLogosCron = createCron(
  {
    name: 'coauth/client/logo/reconcile/cron',
    cron: '0 4 * * *'
  },
  async () => {
    await reconcileConsumerClientLogosManyQueue.add(
      {},
      { id: 'coauth-client-logo-reconcile' }
    );
  }
);

export let reconcileConsumerClientLogosManyQueue = createQueue<{ cursor?: string }>({
  name: 'coauth/client/logo/reconcile/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileConsumerClientLogosManyQueueProcessor =
  reconcileConsumerClientLogosManyQueue.process(async data => {
    let consumerClients = await db.consumerClient.findMany({
      where: {
        logoReconciledAt: null,
        logoUri: null,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: LOGO_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!consumerClients.length) return;

    await reconcileConsumerClientLogoQueue.addManyWithOps(
      consumerClients.map(consumerClient => ({
        data: { consumerClientId: consumerClient.id },
        opts: { id: consumerClient.id }
      }))
    );

    if (consumerClients.length === LOGO_RECONCILE_BATCH_SIZE) {
      await reconcileConsumerClientLogosManyQueue.add(
        { cursor: consumerClients[consumerClients.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileConsumerClientLogoQueue = createQueue<{ consumerClientId: string }>({
  name: 'coauth/client/logo/reconcile/single',
  workerOpts: { concurrency: 5, limiter: { max: 5, duration: 1000 } }
});

export let reconcileConsumerClientLogoQueueProcessor =
  reconcileConsumerClientLogoQueue.process(async data => {
    let consumerClient = await db.consumerClient.findUnique({
      where: { id: data.consumerClientId }
    });
    if (!consumerClient || consumerClient.logoReconciledAt || consumerClient.logoUri) return;

    let discoveryUrl = getConsumerClientLogoDiscoveryUrl(consumerClient);

    if (discoveryUrl) {
      let discovery = await webDiscoveryService.discover({ url: discoveryUrl });

      await applyDiscoveredConsumerClientLogoQueue.add(
        { consumerClientId: consumerClient.id, discoveryId: discovery.id, attempt: 0 },
        { id: `${consumerClient.id}_${discovery.id}_0` }
      );
    }

    await db.consumerClient.updateMany({
      where: { oid: consumerClient.oid, logoReconciledAt: null },
      data: { logoReconciledAt: new Date() }
    });
  });

export let applyDiscoveredConsumerClientLogoQueue = createQueue<{
  consumerClientId: string;
  discoveryId: string;
  attempt: number;
}>({
  name: 'coauth/client/logo/reconcile/apply',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let applyDiscoveredConsumerClientLogoQueueProcessor =
  applyDiscoveredConsumerClientLogoQueue.process(async data => {
    let discovery = await webDiscoveryService.getWebDiscoveryById({
      webDiscoveryId: data.discoveryId
    });

    if (discovery.status === 'failed') return;

    if (discovery.status !== 'succeeded') {
      let nextAttempt = data.attempt + 1;
      if (nextAttempt >= LOGO_POLL_MAX_ATTEMPTS) return;

      await applyDiscoveredConsumerClientLogoQueue.add(
        { ...data, attempt: nextAttempt },
        {
          id: `${data.consumerClientId}_${data.discoveryId}_${nextAttempt}`,
          delay: Math.min(LOGO_POLL_BASE_DELAY_MS * 2 ** data.attempt, LOGO_POLL_MAX_DELAY_MS)
        }
      );
      return;
    }

    if (discovery.image?.type !== 'url') return;

    await db.consumerClient.updateMany({
      where: { id: data.consumerClientId, logoUri: null },
      data: { logoUri: discovery.image.url }
    });
  });

export let reconcileConsumerClientLogosProcessors = combineQueueProcessors([
  reconcileConsumerClientLogosCron,
  reconcileConsumerClientLogosManyQueueProcessor,
  reconcileConsumerClientLogoQueueProcessor,
  applyDiscoveredConsumerClientLogoQueueProcessor
]);
