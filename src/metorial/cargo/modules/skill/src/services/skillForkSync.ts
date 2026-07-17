import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import { resourceActorService } from '@metorial/module-resource-tenant';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission
} from '@metorial/cargo-module-store';
import { db, Prisma } from '@metorial/db';
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
  async createSkillForkSync(
    d: ResourceScope & {
      forkSkillId: string;
      actorId?: string;
    }
  ) {
    let forkSkill = await db.skill.findFirst({
      where: {
        id: d.forkSkillId,
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
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
      ? await resourceActorService.getActorById({
          resourceTenant: d.resourceTenant!,
          actorId: d.actorId
        })
      : undefined;

    await storeAccessService.assertStoreAccessForStore({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      store: upstreamSkill.store!,
      actorId: d.actorId,
      requiredPermission: storeReadPermission
    });
    await storeAccessService.assertStoreAccessForStore({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      store: forkSkill.store!,
      actorId: d.actorId,
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
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid,
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

  async getSkillForkSyncById(
    d: ResourceScope & {
      skillForkSyncId: string;
      actorId?: string;
    }
  ) {
    let sync = await db.skillForkSync.findFirst({
      where: {
        id: d.skillForkSyncId,
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid
      },
      include: skillForkSyncInclude
    });
    if (!sync) throw new ServiceError(notFoundError('skill.forkSync', d.skillForkSyncId));

    await storeAccessService.assertStoreAccessForStore({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      store: sync.forkSkill.store!,
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
