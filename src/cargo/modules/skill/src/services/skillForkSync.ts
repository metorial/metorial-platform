import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, getId, Prisma } from '@metorial-cargo/db';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { actorService } from '@metorial-cargo/module-file';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission
} from '@metorial-cargo/module-store';
import {
  getCanonicalSkillPairKey,
  skillMergePairLock,
  skillMergeTargetLock
} from '../lib/mergeLock';
import { enqueueSkillForkSync } from '../queues/forkSync';
import { statusesForOpenWork } from './skillMergeRequestInternal';

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
  createdByTenantActor: true,
  generatedMergeRequest: true
} satisfies Prisma.SkillForkSyncInclude;

export type SkillForkSyncRecord = Prisma.SkillForkSyncGetPayload<{
  include: typeof skillForkSyncInclude;
}>;

class SkillForkSyncServiceImpl {
  async createSkillForkSync(
    d: CargoTenantEnvironment & {
      forkSkillId: string;
      actorId?: string;
    }
  ) {
    let forkSkill = await db.skill.findFirst({
      where: {
        id: d.forkSkillId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
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
    let actor = d.actorId
      ? await actorService.getActorById({
          tenant: d.tenant,
          actorId: d.actorId
        })
      : undefined;

    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: upstreamSkill.store,
      actorId: d.actorId,
      requiredPermission: storeReadPermission
    });
    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: forkSkill.store,
      actorId: d.actorId,
      requiredPermission: storeWritePermission
    });

    let activePairKey = getCanonicalSkillPairKey(forkSkill.oid, upstreamSkill.oid);
    let sync = await skillMergePairLock.usingLock(
      activePairKey,
      async () =>
        await skillMergeTargetLock.usingLock(forkSkill.store.id, async () => {
          let activeRequest = await db.skillMergeRequest.findFirst({
            where: {
              status: {
                in: statusesForOpenWork
              },
              OR: [
                {
                  sourceSkillOid: forkSkill.oid,
                  targetSkillOid: upstreamSkill.oid
                },
                {
                  sourceSkillOid: upstreamSkill.oid,
                  targetSkillOid: forkSkill.oid
                }
              ]
            }
          });
          let activeSync = await db.skillForkSync.findFirst({
            where: {
              activePairKey,
              status: {
                in: ['pending', 'processing', 'action_required']
              }
            }
          });
          if (activeRequest || activeSync) {
            throw new ServiceError(
              badRequestError({
                message: 'An active merge request or fork synchronization already exists'
              })
            );
          }

          let ids = getId('skillForkSync');
          return await db.skillForkSync.create({
            data: {
              oid: ids.oid,
              id: ids.id,
              activePairKey,
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              forkSkillOid: forkSkill.oid,
              upstreamSkillOid: upstreamSkill.oid,
              createdByTenantActorOid: actor?.oid
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

  async getSkillForkSyncById(
    d: CargoTenantEnvironment & {
      skillForkSyncId: string;
      actorId?: string;
    }
  ) {
    let sync = await db.skillForkSync.findFirst({
      where: {
        id: d.skillForkSyncId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include: skillForkSyncInclude
    });
    if (!sync) throw new ServiceError(notFoundError('skill.forkSync', d.skillForkSyncId));

    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: sync.forkSkill.store,
      actorId: d.actorId,
      requiredPermission: storeReadPermission
    });
    return sync;
  }
}

export let skillForkSyncService = Service.create(
  'cargoSkillForkSyncService',
  () => new SkillForkSyncServiceImpl()
).build();
