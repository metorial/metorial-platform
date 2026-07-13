import { createQueue } from '@lowerdeck/queue';
import { db, env } from '@metorial-cargo/db';
import { materializeImportedSkill } from '../../import/materialize';
import type { SkillRecord } from '../../services/skill';
import { skillService } from '../../services/skill';
import { skillImportFinishQueue } from './finish';

export let skillImportItemQueue = createQueue<{ skillImportItemId: string }>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/import/item',
  workerOpts: {
    concurrency: 5
  }
});

let errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Skill import failed';

export let skillImportItemQueueProcessor = skillImportItemQueue.process(async data => {
  let item = await db.skillImportItem.findUnique({
    where: { id: data.skillImportItemId },
    include: {
      skillImport: {
        include: {
          tenant: true,
          environment: true,
          creatorTenantActor: true
        }
      },
      skill: {
        include: {
          store: true,
          parentSkill: { select: { id: true } },
          parentSkillTemplate: { select: { id: true } }
        }
      }
    }
  });
  if (!item) return;
  if (item.status === 'completed' || item.status === 'failed') {
    if (item.status === 'failed') {
      let cleanupSkill =
        item.skill ??
        (await db.skill.findFirst({
          where: {
            id: item.targetSkillId,
            tenantOid: item.skillImport.tenantOid,
            environmentOid: item.skillImport.environmentOid,
            status: 'active'
          },
          include: {
            store: true,
            parentSkill: { select: { id: true } },
            parentSkillTemplate: { select: { id: true } }
          }
        }));
      if (cleanupSkill) {
        await skillService.archiveSkill({
          tenant: item.skillImport.tenant,
          environment: item.skillImport.environment,
          skill: cleanupSkill
        });
      }
      await db.skillImportItem.updateMany({
        where: { id: item.id, status: 'failed' },
        data: {
          skillOid: null,
          cleanupCompletedAt: new Date()
        }
      });
    }
    if (item.skillImport.status === 'processing') {
      await skillImportFinishQueue.add({ skillImportId: item.skillImport.id });
    }
    return;
  }
  if (item.skillImport.status !== 'processing') return;
  if (item.status !== 'pending') return;

  let claimed = await db.skillImportItem.updateMany({
    where: { id: item.id, status: 'pending' },
    data: {
      status: 'processing',
      startedAt: new Date(),
      heartbeatAt: new Date(),
      error: null
    }
  });
  if (claimed.count === 0) return;

  let createdSkill: SkillRecord | undefined;
  try {
    if (!item.skillImport.codeBucketId) throw new Error('Import codebucket is missing');

    createdSkill = await materializeImportedSkill({
      tenant: item.skillImport.tenant,
      environment: item.skillImport.environment,
      codeBucketId: item.skillImport.codeBucketId,
      skillId: item.targetSkillId,
      rootPath: item.path,
      repositoryName: item.skillImport.repositoryName,
      actorId: item.skillImport.creatorTenantActor?.id,
      onSkillCreated: async skill => {
        createdSkill = skill;
        let linked = await db.skillImportItem.updateMany({
          where: { id: item.id, status: 'processing' },
          data: {
            skillOid: skill.oid,
            heartbeatAt: new Date()
          }
        });
        if (linked.count === 0) throw new Error('Skill import item is no longer active');
      },
      onProgress: async () => {
        let heartbeat = await db.skillImportItem.updateMany({
          where: { id: item.id, status: 'processing' },
          data: { heartbeatAt: new Date() }
        });
        if (heartbeat.count === 0) throw new Error('Skill import item is no longer active');
      }
    });

    let completed = await db.skillImportItem.updateMany({
      where: { id: item.id, status: 'processing' },
      data: {
        status: 'completed',
        skillOid: createdSkill.oid,
        heartbeatAt: new Date(),
        completedAt: new Date()
      }
    });
    if (completed.count === 0) {
      await skillService.archiveSkill({
        tenant: item.skillImport.tenant,
        environment: item.skillImport.environment,
        skill: createdSkill
      });
    }
  } catch (error) {
    let cleanupSucceeded = !createdSkill;
    if (createdSkill) {
      try {
        await skillService.archiveSkill({
          tenant: item.skillImport.tenant,
          environment: item.skillImport.environment,
          skill: createdSkill
        });
        cleanupSucceeded = true;
      } catch {
        // The item error remains authoritative; stale archived content is cleaned up separately.
      }
    }

    await db.skillImportItem.updateMany({
      where: { id: item.id, status: 'processing' },
      data: {
        status: 'failed',
        error: errorMessage(error),
        skillOid: cleanupSucceeded ? null : undefined,
        cleanupCompletedAt: cleanupSucceeded ? new Date() : undefined,
        completedAt: new Date()
      }
    });
  }

  await skillImportFinishQueue.add({ skillImportId: item.skillImport.id });
});
