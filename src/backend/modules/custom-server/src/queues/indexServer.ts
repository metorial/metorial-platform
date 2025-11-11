import { db } from '@metorial/db';
import { searchService } from '@metorial/module-search';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let indexCustomServerQueue = createQueue<{
  customServerId: string;
}>({
  name: 'csv/srv/sidx'
});

export let indexCustomServerQueueProcessor = indexCustomServerQueue.process(async data => {
  let server = await db.customServer.findUnique({
    where: {
      id: data.customServerId
    },
    include: {
      instance: true,
      server: true
    }
  });
  if (!server) throw new QueueRetryError();

  await searchService.indexDocument({
    index: 'custom_server',
    document: {
      id: server.id,
      instanceId: server.instance.id,
      name: server.name,
      description: server.description,
      serverName: server.server.name,
      serverDescription: server.server.description
    }
  });
});
