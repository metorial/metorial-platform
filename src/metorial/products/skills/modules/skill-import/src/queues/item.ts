import { skillService, type SkillRecord } from '@metorial/module-skill';
import { db } from '@metorial/db';
import { consumerSkillService } from '@metorial/module-consumer';
import { createQueue } from '@metorial/queue';
import { materializeImportedSkill } from '../lib/materialize';
import { skillImportFinishQueue } from './finish';

export let skillImportItemQueue = createQueue<{ skillImportItemId: string }>({
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
          creatorResourceActor: true,
          project: true,
          instance: true
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
            projectOid: item.skillImport.project.oid,
            instanceOid: item.skillImport.instance.oid,
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
          project: item.skillImport.project,
          instance: item.skillImport.instance,
          skill: cleanupSkill,
          authorization: { type: 'privileged' }
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

    let actor = item.skillImport.creatorResourceActor ?? undefined;
    let consumerProfileOid = actor?.consumerProfileOid ?? undefined;
    createdSkill = await materializeImportedSkill({
      project: item.skillImport.project,
      instance: item.skillImport.instance,
      codeBucketId: item.skillImport.codeBucketId,
      skillId: item.targetSkillId,
      rootPath: item.path,
      repositoryName:
        item.skillImport.repositoryName ??
        item.skillImport.sourceFileName?.replace(/\.(zip|md|markdown)$/i, ''),
      actor,
      authorization: {
        type: 'privileged',
        resourceActor: actor
      },
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

    if (consumerProfileOid != null) {
      await consumerSkillService.grantImportedSkillAccess({
        skill: createdSkill,
        consumerProfileOid
      });
    }

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
        project: item.skillImport.project,
        instance: item.skillImport.instance,
        skill: createdSkill,
        authorization: { type: 'privileged' }
      });
    }
  } catch (error) {
    let cleanupSucceeded = !createdSkill;
    if (createdSkill) {
      try {
        await skillService.archiveSkill({
          project: item.skillImport.project,
          instance: item.skillImport.instance,
          skill: createdSkill,
          authorization: { type: 'privileged' }
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
