import { db } from '@metorial/db';
import {
  deleteMagicMcpGroupDocument,
  indexMagicMcpGroupDocument
} from '@metorial/module-search';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let indexMagicMcpGroupSearchQueue = createQueue<{ magicMcpGroupId: string }>({
  name: 'mgc/sidx/group'
});

export let indexMagicMcpGroupSearchQueueProcessor = indexMagicMcpGroupSearchQueue.process(
  async data => {
    let magicMcpGroup = await db.magicMcpGroup.findUnique({
      where: { id: data.magicMcpGroupId },
      include: { instance: true }
    });
    if (!magicMcpGroup) throw new QueueRetryError();

    if (magicMcpGroup.status === 'deleted') {
      await deleteMagicMcpGroupDocument({ id: magicMcpGroup.id });
      return;
    }

    await indexMagicMcpGroupDocument({
      id: magicMcpGroup.id,
      instanceId: magicMcpGroup.instance.id,
      slug: magicMcpGroup.slug,
      name: magicMcpGroup.name,
      description: magicMcpGroup.description
    });
  }
);
