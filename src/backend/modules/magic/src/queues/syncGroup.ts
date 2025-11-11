import { db } from '@metorial/db';
import { searchService } from '@metorial/module-search';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let syncMagicMcpGroupQueue = createQueue<{
  magicMcpGroupId: string;
}>({
  name: 'mgc/grp/snc'
});

export let syncMagicMcpGroupQueueProcessor = syncMagicMcpGroupQueue.process(async data => {
  let group = await db.magicMcpGroup.findUnique({
    where: {
      id: data.magicMcpGroupId
    },
    include: {
      instance: true
    }
  });
  if (!group) throw new QueueRetryError();

  await searchService.indexDocument({
    index: 'magic_mcp_group',
    document: {
      id: group.id,
      instanceId: group.instance.id,
      name: group.name,
      description: group.description
    }
  });
});
