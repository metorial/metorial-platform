import {
  commitWatermarkScan,
  createQueueCheckpoint,
  enqueueWatermarkScan,
  watermarkScanWhere,
  type WatermarkScanJob
} from '@lowerdeck/queue-checkpoint';
import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { storeAccessGrantService } from '@metorial/module-access';
import { storeParticipantService } from '@metorial/module-store';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';

export let SKILL_STORE_RESOURCE_BACKFILL_BATCH_SIZE = 500;

let skillParticipantCheckpoint = createQueueCheckpoint({
  db,
  queue: 'cargo/skill/participant/store-backfill'
});

let skillGrantCheckpoint = createQueueCheckpoint({
  db,
  queue: 'cargo/skill/grant/store-backfill'
});

export let skillParticipantStoreBackfillCron = createCron(
  {
    name: 'cargo/skill/participant/store-backfill/cron',
    cron: '7,37 * * * *'
  },
  async () => {
    await enqueueWatermarkScan({
      checkpoint: skillParticipantCheckpoint,
      queue: skillParticipantStoreBackfillManyQueue
    });
  }
);

export let skillParticipantStoreBackfillManyQueue = createQueue<WatermarkScanJob>({
  name: 'cargo/skill/participant/store-backfill/many',
  workerOpts: { concurrency: 1 }
});

export let skillParticipantStoreBackfillManyQueueProcessor =
  skillParticipantStoreBackfillManyQueue.process(async job => {
    let participants = await db.skillParticipant.findMany({
      where: {
        ...watermarkScanWhere(job),
        id: job.cursor ? { gt: job.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: SKILL_STORE_RESOURCE_BACKFILL_BATCH_SIZE,
      select: { id: true }
    });

    if (participants.length) {
      await skillParticipantStoreBackfillSingleQueue.addManyWithOps(
        participants.map(participant => ({
          data: { skillParticipantId: participant.id },
          opts: { id: participant.id }
        }))
      );
    }

    if (participants.length === SKILL_STORE_RESOURCE_BACKFILL_BATCH_SIZE) {
      await skillParticipantStoreBackfillManyQueue.add(
        { ...job, cursor: participants[participants.length - 1]!.id },
        hourlyPacedDelay()
      );
      return;
    }

    await commitWatermarkScan({ checkpoint: skillParticipantCheckpoint, job });
  });

export let skillParticipantStoreBackfillSingleQueue = createQueue<{
  skillParticipantId: string;
}>({
  name: 'cargo/skill/participant/store-backfill/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let skillParticipantStoreBackfillSingleQueueProcessor =
  skillParticipantStoreBackfillSingleQueue.process(async data => {
    let participant = await db.skillParticipant.findUnique({
      where: { id: data.skillParticipantId },
      include: { skill: { select: { storeOid: true } } }
    });
    if (!participant?.skill.storeOid) return;

    await storeParticipantService.recordParticipation({
      store: { oid: participant.skill.storeOid },
      actor: { oid: participant.resourceActorOid },
      roles: participant.roles,
      activeAt: participant.updatedAt,
      createdAt: participant.createdAt
    });
  });

export let skillGrantStoreBackfillCron = createCron(
  {
    name: 'cargo/skill/grant/store-backfill/cron',
    cron: '14,44 * * * *'
  },
  async () => {
    await enqueueWatermarkScan({
      checkpoint: skillGrantCheckpoint,
      queue: skillGrantStoreBackfillManyQueue
    });
  }
);

export let skillGrantStoreBackfillManyQueue = createQueue<WatermarkScanJob>({
  name: 'cargo/skill/grant/store-backfill/many',
  workerOpts: { concurrency: 1 }
});

export let skillGrantStoreBackfillManyQueueProcessor =
  skillGrantStoreBackfillManyQueue.process(async job => {
    let skills = await db.skill.findMany({
      where: {
        ...watermarkScanWhere(job),
        storeOid: { not: null },
        id: job.cursor ? { gt: job.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: SKILL_STORE_RESOURCE_BACKFILL_BATCH_SIZE,
      select: { id: true }
    });

    if (skills.length) {
      await skillGrantStoreBackfillSingleQueue.addManyWithOps(
        skills.map(skill => ({ data: { skillId: skill.id }, opts: { id: skill.id } }))
      );
    }

    if (skills.length === SKILL_STORE_RESOURCE_BACKFILL_BATCH_SIZE) {
      await skillGrantStoreBackfillManyQueue.add(
        { ...job, cursor: skills[skills.length - 1]!.id },
        hourlyPacedDelay()
      );
      return;
    }

    await commitWatermarkScan({ checkpoint: skillGrantCheckpoint, job });
  });

export let skillGrantStoreBackfillSingleQueue = createQueue<{ skillId: string }>({
  name: 'cargo/skill/grant/store-backfill/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let skillGrantStoreBackfillSingleQueueProcessor =
  skillGrantStoreBackfillSingleQueue.process(async data => {
    let skill = await db.skill.findUnique({
      where: { id: data.skillId },
      select: { oid: true }
    });
    if (!skill) return;

    await storeAccessGrantService.syncLegacySkillGrants({ skillOid: skill.oid });
  });

export let skillStoreResourceBackfillProcessors = combineQueueProcessors([
  skillParticipantStoreBackfillCron,
  skillParticipantStoreBackfillManyQueueProcessor,
  skillParticipantStoreBackfillSingleQueueProcessor,
  skillGrantStoreBackfillCron,
  skillGrantStoreBackfillManyQueueProcessor,
  skillGrantStoreBackfillSingleQueueProcessor
]);
