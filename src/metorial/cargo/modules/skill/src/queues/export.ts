import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { skillExportService } from '../services/skillExport';

export let skillExportQueue = createQueue<{
  skillExportId: string;
  skillDestinationSyncId?: string;
}>({
  name: 'cargo/skill/export',
  workerOpts: {
    concurrency: 5
  }
});

export let enqueueSkillExport = async (
  d: {
    skillExportId: string;
    skillDestinationSyncId?: string;
  },
  opts?: {
    delay?: number;
  }
) => {
  await skillExportQueue.add(d, opts);
};

export let skillExportQueueProcessor = skillExportQueue.process(async data => {
  let skillExport = await db.skillExport.findUnique({
    where: {
      id: data.skillExportId
    },
    include: {
      resourceTenant: true,
      resourceGroup: true
    }
  });

  if (!skillExport) throw new QueueRetryError();

  await skillExportService.processSkillExport({
    resourceTenant: skillExport.resourceTenant!,
    resourceGroup: skillExport.resourceGroup,
    skillExportId: skillExport.id,
    skillDestinationSyncId: data.skillDestinationSyncId
  });
});
