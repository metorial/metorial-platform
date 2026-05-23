import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { db, env } from '@metorial-cargo/db';
import { skillExportService } from '../services/skillExport';

export let skillExportQueue = createQueue<{
  skillExportId: string;
  skillDestinationSyncId?: string;
}>({
  redisUrl: env.service.REDIS_URL,
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
      tenant: true,
      environment: true
    }
  });

  if (!skillExport) throw new QueueRetryError();

  await skillExportService.processSkillExport({
    tenant: skillExport.tenant,
    environment: skillExport.environment,
    skillExportId: skillExport.id,
    skillDestinationSyncId: data.skillDestinationSyncId
  });
});
