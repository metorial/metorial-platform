import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { skillExportService } from '../services/skillExport';

export type SkillExportJobData = {
  skillExportId: string;
  skillDestinationSyncId?: string;
  manifestId?: string;
  zipStartedAt?: number;
  zipPolls?: number;
  syncWaits?: number;
};

export let skillExportQueue = createQueue<SkillExportJobData>({
  name: 'cargo/skill/export',
  workerOpts: {
    concurrency: 5
  }
});

export let enqueueSkillExport = async (
  d: SkillExportJobData,
  opts?: {
    delay?: number;
  }
) => {
  await skillExportQueue.add(
    {
      skillExportId: d.skillExportId,
      skillDestinationSyncId: d.skillDestinationSyncId,
      manifestId: d.manifestId,
      zipStartedAt: d.zipStartedAt,
      zipPolls: d.zipPolls,
      syncWaits: d.syncWaits
    },
    opts
  );
};

export let skillExportQueueProcessor = skillExportQueue.process(async data => {
  let skillExport = await db.skillExport.findUnique({
    where: {
      id: data.skillExportId
    },
    include: {
      project: true,
      instance: true
    }
  });

  if (!skillExport) throw new QueueRetryError();

  await skillExportService.processSkillExport({
    project: skillExport.project,
    instance: skillExport.instance,
    skillExportId: skillExport.id,
    skillDestinationSyncId: data.skillDestinationSyncId,
    manifestId: data.manifestId,
    zipStartedAt: data.zipStartedAt,
    zipPolls: data.zipPolls,
    syncWaits: data.syncWaits
  });
});
