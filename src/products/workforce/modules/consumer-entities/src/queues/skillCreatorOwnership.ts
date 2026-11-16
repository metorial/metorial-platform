import { createQueueCheckpoint } from '@lowerdeck/queue-checkpoint';
import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { storeParticipantService } from '@metorial/module-store';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { consumerSkillService } from '../services/consumerSkill';

let SKILL_CREATOR_OWNERSHIP_BATCH_SIZE = 500;

// One-time backfill: skills created before owners existed made their consumer creator an editor
// with manage access. Once the checkpoint is committed the scan never runs again, so an owner an
// admin later removes is not re-promoted.
let skillCreatorOwnershipCheckpoint = createQueueCheckpoint({
  db,
  queue: 'cons/skill/creator-ownership'
});

export let skillCreatorOwnershipCron = createCron(
  { name: 'cons/skill/creator-ownership/cron', cron: '0 * * * *' },
  async () => {
    if (await skillCreatorOwnershipCheckpoint.since()) return;

    await skillCreatorOwnershipManyQueue.add(
      { createdBefore: new Date().toISOString() },
      { id: 'scan' }
    );
  }
);

export let skillCreatorOwnershipManyQueue = createQueue<{
  createdBefore: string;
  cursor?: string;
}>({
  name: 'cons/skill/creator-ownership/many',
  workerOpts: { concurrency: 1 }
});

export let skillCreatorOwnershipManyProcessor = skillCreatorOwnershipManyQueue.process(
  async data => {
    let skills = await db.skill.findMany({
      where: {
        status: 'active',
        storeOid: { not: null },
        createdByConsumerProfileOid: { not: null },
        createdByResourceActorOid: { not: null },
        createdAt: { lt: new Date(data.createdBefore) },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: SKILL_CREATOR_OWNERSHIP_BATCH_SIZE,
      select: { id: true }
    });

    if (skills.length) {
      await skillCreatorOwnershipSingleQueue.addManyWithOps(
        skills.map(skill => ({ data: { skillId: skill.id }, opts: { id: skill.id } }))
      );
    }

    if (skills.length === SKILL_CREATOR_OWNERSHIP_BATCH_SIZE) {
      await skillCreatorOwnershipManyQueue.add(
        { ...data, cursor: skills[skills.length - 1]!.id },
        hourlyPacedDelay()
      );
      return;
    }

    await skillCreatorOwnershipCheckpoint.commit(new Date(data.createdBefore));
  }
);

export let skillCreatorOwnershipSingleQueue = createQueue<{ skillId: string }>({
  name: 'cons/skill/creator-ownership/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let skillCreatorOwnershipSingleProcessor = skillCreatorOwnershipSingleQueue.process(
  async data => {
    let skill = await db.skill.findUnique({ where: { id: data.skillId } });
    if (
      !skill?.storeOid ||
      !skill.createdByConsumerProfileOid ||
      !skill.createdByResourceActorOid
    ) {
      return;
    }

    let creatorProfile = await db.consumerProfile.findFirst({
      where: { oid: skill.createdByConsumerProfileOid, status: 'active' },
      select: { oid: true }
    });
    if (!creatorProfile) return;

    let creatorRole = await storeParticipantService.getActorAccessRole({
      store: { oid: skill.storeOid },
      actor: { oid: skill.createdByResourceActorOid }
    });
    if (creatorRole != 'editor') return;

    await consumerSkillService.grantConsumerSkillOwnership({
      consumerProfileOid: creatorProfile.oid,
      skill
    });
  }
);

export let skillCreatorOwnershipProcessors = combineQueueProcessors([
  skillCreatorOwnershipCron,
  skillCreatorOwnershipManyProcessor,
  skillCreatorOwnershipSingleProcessor
]);
