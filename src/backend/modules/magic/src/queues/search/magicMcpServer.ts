import { db } from '@metorial/db';
import {
  deleteMagicMcpServerDocument,
  indexMagicMcpServerDocument
} from '@metorial/module-search';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let indexMagicMcpServerSearchQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/sidx/server'
});

export let indexMagicMcpServerSearchQueueProcessor = indexMagicMcpServerSearchQueue.process(
  async data => {
    let magicMcpServer = await db.magicMcpServer.findUnique({
      where: { id: data.magicMcpServerId },
      include: { instance: true, aliases: true }
    });
    if (!magicMcpServer) throw new QueueRetryError();

    if (magicMcpServer.status === 'deleted') {
      await deleteMagicMcpServerDocument({ id: magicMcpServer.id });
      return;
    }

    await indexMagicMcpServerDocument({
      id: magicMcpServer.id,
      instanceId: magicMcpServer.instance.id,
      name: magicMcpServer.name,
      description: magicMcpServer.description,
      aliases: magicMcpServer.aliases.map(alias => alias.slug)
    });
  }
);
