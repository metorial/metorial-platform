import { db } from '@metorial/db';
import { searchService } from '@metorial/module-search';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let indexServerListingQueue = createQueue<{ serverListingId: string }>({
  name: 'cat/search/srvlst',
  workerOpts: {
    concurrency: 1,
    limiter: process.env.NODE_ENV == 'development' ? undefined : { max: 20, duration: 1000 }
  }
});

export let indexServerListingQueueProcessor = indexServerListingQueue.process(async data => {
  let server = await db.serverListing.findFirst({
    where: {
      id: data.serverListingId
    },
    include: {
      categories: true,
      collections: true
    }
  });
  if (!server) throw new QueueRetryError();

  await searchService.indexDocument({
    index: 'server_listing',
    document: {
      id: server.id,
      name: server.name,
      description: server.description,
      readme: server.readme,

      categories: server.categories.map(c => ({
        id: c.id,
        name: c.name
      }))
    }
  });
});
