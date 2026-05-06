import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { ensureProviderTemplateBacking } from '../lib/backing';

let BATCH_SIZE = 100;

export let reconcileProviderTemplatesCron = createCron(
  {
    name: 'magic/provider-template/reconcile/cron',
    cron: '* * * * *'
  },
  async () => {
    await reconcileProviderTemplatesManyQueue.add({});
  }
);

export let reconcileProviderTemplatesManyQueue = createQueue<{ cursor?: string }>({
  name: 'magic/provider-template/reconcile/many',
  workerOpts: {
    concurrency: 2
  }
});

let reconcileProviderTemplatesManyQueueProcessor = reconcileProviderTemplatesManyQueue.process(
  async data => {
    let providerTemplates = await db.providerTemplate.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        status: 'active',
        OR: [{ hasSubspaceBacking: false }, { subspaceIntegrationId: null }]
      },
      take: BATCH_SIZE,
      orderBy: {
        id: 'asc'
      },
      select: {
        id: true
      }
    });

    if (providerTemplates.length === 0) return;

    await reconcileProviderTemplatesSingleQueue.addMany(
      providerTemplates.map(providerTemplate => ({
        providerTemplateId: providerTemplate.id
      }))
    );

    await reconcileProviderTemplatesManyQueue.add({
      cursor: providerTemplates[providerTemplates.length - 1]!.id
    });
  }
);

export let reconcileProviderTemplatesSingleQueue = createQueue<{
  providerTemplateId: string;
}>({
  name: 'magic/provider-template/reconcile/single',
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 5,
      duration: 1000
    }
  }
});

let reconcileProviderTemplatesSingleQueueProcessor =
  reconcileProviderTemplatesSingleQueue.process(async data => {
    let providerTemplate = await db.providerTemplate.findUnique({
      where: {
        id: data.providerTemplateId
      },
      include: {
        instance: true
      }
    });
    if (!providerTemplate || providerTemplate.status !== 'active') return;

    await ensureProviderTemplateBacking({
      instance: providerTemplate.instance,
      providerTemplate
    });
  });

export let reconcileProviderTemplatesProcessors = combineQueueProcessors([
  reconcileProviderTemplatesCron,
  reconcileProviderTemplatesManyQueueProcessor,
  reconcileProviderTemplatesSingleQueueProcessor
]);
