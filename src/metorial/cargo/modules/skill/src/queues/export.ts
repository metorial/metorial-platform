import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { requireRecordScope } from '../internal/scope';
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
    }
  });

  if (!skillExport) throw new QueueRetryError();

  await skillExportService.processSkillExport({
    ...requireRecordScope('Skill export', skillExport),
    skillExportId: skillExport.id,
    skillDestinationSyncId: data.skillDestinationSyncId
  });
});
