import { createCron } from '@metorial/cron';
import { db, ID } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';

let BATCH_SIZE = 100;

let backfillAccessListingsCron = createCron(
  {
    name: 'cons/accessListing/backfill',
    cron: '* * * * *'
  },
  async () => {
    await backfillAccessListingsBatchQueue.add({});
  }
);

let backfillAccessListingsBatchQueue = createQueue<{}>({
  name: 'cons/accessListing/backfillBatch'
});

let backfillAccessListingsBatchQueueProcessor = backfillAccessListingsBatchQueue.process(
  async () => {
    let accessesWithoutListing = await db.consumerAccess.findMany({
      where: { listingOid: null },
      select: { id: true },
      take: BATCH_SIZE
    });

    if (accessesWithoutListing.length === 0) return;

    await backfillSingleAccessListingQueue.addMany(
      accessesWithoutListing.map(access => ({
        consumerAccessId: access.id
      }))
    );

    if (accessesWithoutListing.length === BATCH_SIZE) {
      await backfillAccessListingsBatchQueue.add({});
    }
  }
);

let backfillSingleAccessListingQueue = createQueue<{ consumerAccessId: string }>({
  name: 'cons/accessListing/backfillSingle',
  workerOpts: {
    concurrency: 5
  }
});

let backfillSingleAccessListingQueueProcessor = backfillSingleAccessListingQueue.process(
  async data => {
    let consumerAccess = await db.consumerAccess.findUnique({
      where: {
        id: data.consumerAccessId,
        listingOid: null
      },
      include: {
        providerTemplate: true,
        magicMcpServer: true
      }
    });

    if (!consumerAccess) return;

    let name: string;
    let description: string | null;

    if (consumerAccess.type === 'provider_template' && consumerAccess.providerTemplate) {
      name = consumerAccess.providerTemplate.name;
      description = consumerAccess.providerTemplate.description;
    } else if (consumerAccess.type === 'magic_mcp_server' && consumerAccess.magicMcpServer) {
      name = consumerAccess.magicMcpServer.name ?? consumerAccess.magicMcpServer.id;
      description = consumerAccess.magicMcpServer.description;
    } else {
      return;
    }

    let listing = await db.consumerAccessListing.upsert({
      where:
        consumerAccess.type === 'provider_template'
          ? {
              surfaceOid_providerTemplateOid: {
                surfaceOid: consumerAccess.surfaceOid,
                providerTemplateOid: consumerAccess.providerTemplateOid!
              }
            }
          : {
              surfaceOid_magicMcpServerOid: {
                surfaceOid: consumerAccess.surfaceOid,
                magicMcpServerOid: consumerAccess.magicMcpServerOid!
              }
            },
      create: {
        id: await ID.generateId('consumerAccess'),
        surfaceOid: consumerAccess.surfaceOid,
        providerTemplateOid: consumerAccess.providerTemplateOid ?? undefined,
        magicMcpServerOid: consumerAccess.magicMcpServerOid ?? undefined,
        name,
        description
      },
      update: {}
    });

    await db.consumerAccess.updateMany({
      where:
        consumerAccess.type === 'provider_template'
          ? {
              surfaceOid: consumerAccess.surfaceOid,
              providerTemplateOid: consumerAccess.providerTemplateOid
            }
          : {
              surfaceOid: consumerAccess.surfaceOid,
              magicMcpServerOid: consumerAccess.magicMcpServerOid
            },
      data: {
        listingOid: listing.oid
      }
    });
  }
);

export let backfillAccessListingsProcessors = combineQueueProcessors([
  backfillAccessListingsCron,
  backfillAccessListingsBatchQueueProcessor,
  backfillSingleAccessListingQueueProcessor
]);
