import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import type { ResourceAuthorization } from '@metorial/module-access';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission
} from '@metorial/cargo-module-store';
import { db, Prisma } from '@metorial/db';
import type { Project, Instance } from '@metorial/db';
import {
  getCanonicalSkillPairKey,
  skillMergePairLock,
  skillMergeTargetLock
} from '../lib/mergeLock';
import { enqueueSkillForkSync } from '../queues/forkSync';

export let skillForkSyncInclude = {
  forkSkill: {
    include: {
      store: true
    }
  },
  upstreamSkill: {
    include: {
      store: true
    }
  },
  createdByResourceActor: true,
  generatedMergeRequest: true
} satisfies Prisma.SkillForkSyncInclude;

export type SkillForkSyncRecord = Prisma.SkillForkSyncGetPayload<{
  include: typeof skillForkSyncInclude;
}>;

class SkillForkSyncServiceImpl {
  async createSkillForkSync(d: {
    project: Project;
    instance: Instance;
    forkSkillId: string;
    authorization: ResourceAuthorization;
  }) {
    let forkSkill = await db.skill.findFirst({
      where: {
        id: d.forkSkillId,
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
        status: 'active'
      },
      include: {
        store: true,
        parentSkill: {
          include: {
            store: true
          }
        }
      }
    });
    if (!forkSkill) throw new ServiceError(notFoundError('skill', d.forkSkillId));
    if (!forkSkill.parentSkill || !forkSkill.forkedFromSkillVersionOid) {
      throw new ServiceError(
        badRequestError({ message: 'Skill must be a fork with a recorded upstream base' })
      );
    }

    let upstreamSkill = forkSkill.parentSkill;
    let actor = d.authorization.resourceActor;

    await storeAccessService.assertStoreAccessForStore({
      project: d.project,
      instance: d.instance,
      store: upstreamSkill.store!,
      authorization: d.authorization,
      requiredPermission: storeReadPermission
    });
    await storeAccessService.assertStoreAccessForStore({
      project: d.project,
      instance: d.instance,
      store: forkSkill.store!,
      authorization: d.authorization,
      requiredPermission: storeWritePermission
    });

    let activePairKey = getCanonicalSkillPairKey(forkSkill.oid, upstreamSkill.oid);
    let sync = await skillMergePairLock.usingLock(
      activePairKey,
      async () =>
        await skillMergeTargetLock.usingLock(forkSkill.store!.id, async () => {
          let activeSync = await db.skillForkSync.findFirst({
            where: {
              activePairKey,
              status: {
                in: ['pending', 'processing', 'action_required']
              }
            }
          });
          if (activeSync) {
            throw new ServiceError(
              badRequestError({
                message: 'An active fork synchronization already exists for this fork'
              })
            );
          }

          let ids = getId('skillForkSync');
          return await db.skillForkSync.create({
            data: {
              oid: ids.oid,
              id: ids.id,
              activePairKey,
              projectOid: d.project.oid,
              instanceOid: d.instance.oid,
              forkSkillOid: forkSkill.oid,
              upstreamSkillOid: upstreamSkill.oid,
              createdByResourceActorOid: actor?.oid
            },
            include: skillForkSyncInclude
          });
        })
    );

    try {
      await enqueueSkillForkSync({ skillForkSyncId: sync.id });
      return sync;
    } catch (err) {
      let error =
        err instanceof Error ? err.message : 'Failed to enqueue fork synchronization';
      return await db.skillForkSync.update({
        where: { id: sync.id },
        data: {
          status: 'failed',
          activePairKey: null,
          error,
          failedAt: new Date()
        },
        include: skillForkSyncInclude
      });
    }
  }

  async getSkillForkSyncById(d: {
    project: Project;
    instance: Instance;
    skillForkSyncId: string;
    authorization: ResourceAuthorization;
  }) {
    let sync = await db.skillForkSync.findFirst({
      where: {
        id: d.skillForkSyncId,
        projectOid: d.project.oid,
        instanceOid: d.instance.oid
      },
      include: skillForkSyncInclude
    });
    if (!sync) throw new ServiceError(notFoundError('skill.forkSync', d.skillForkSyncId));

    await storeAccessService.assertStoreAccessForStore({
      project: d.project,
      instance: d.instance,
      store: sync.forkSkill.store!,
      authorization: d.authorization,
      requiredPermission: storeReadPermission
    });
    return sync;
  }
}

export let skillForkSyncService = Service.create(
  'cargoSkillForkSyncService',
  () => new SkillForkSyncServiceImpl()
).build();
