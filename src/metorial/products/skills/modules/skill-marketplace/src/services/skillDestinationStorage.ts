import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { createSystemAuditScope, type AuditScope } from '@metorial/audit-scope';
import { db, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { getOriginTenant, origin } from '@metorial/skills-scm-utils';
import { forceSkillDestinationSync } from '../lib/destinationSync';
import {
  skillDestinationMigrateStorageManyQueue,
  skillDestinationMigrateStorageSingleQueue
} from '../queues/storage';
import { withDestinationSyncLock } from '../queues/sync/_lib/lock';
import { convertSkillDestinationRowsToBucketPaths } from '../queues/sync/_lib/rowPaths';

let runningSyncStatuses = ['pending', 'processing'] as const;

let destinationOwnerInclude = {
  skillMarketplace: { select: { organizationOid: true, instanceOid: true, projectOid: true } },
  skillPlugin: {
    select: { organizationOid: true, instanceOid: true, projectOid: true, isManaged: true }
  }
} as const;

class SkillDestinationStorageServiceImpl {
  async migrateSkillDestinationStorage(d: {
    skillDestinationId?: string;
    organizationId?: string;
  }) {
    if (d.skillDestinationId) {
      let destination = await db.skillDestination.findUnique({
        where: { id: d.skillDestinationId },
        select: { id: true }
      });
      if (!destination) {
        throw new ServiceError(notFoundError('skill.destination', d.skillDestinationId));
      }

      await skillDestinationMigrateStorageSingleQueue.add(
        { destinationId: destination.id, requestedBy: 'ops' },
        { id: `migrate:ops:${destination.id}:${Date.now()}` }
      );
      return { enqueued: 'destination' as const };
    }

    if (d.organizationId) {
      let organization = await db.organization.findUnique({
        where: { id: d.organizationId },
        select: { oid: true }
      });
      if (!organization) {
        throw new ServiceError(notFoundError('organization', d.organizationId));
      }

      await skillDestinationMigrateStorageManyQueue.add({
        organizationOid: organization.oid.toString()
      });
      return { enqueued: 'organization' as const };
    }

    throw new ServiceError(
      badRequestError({ message: 'Pass a skill destination or an organization to migrate.' })
    );
  }

  async demoteSkillDestinationToCodeBucket(d: {
    skillDestinationId: string;
    auditScope?: AuditScope;
  }) {
    let destination = await db.skillDestination.findUnique({
      where: { id: d.skillDestinationId },
      include: destinationOwnerInclude
    });
    if (!destination) {
      throw new ServiceError(notFoundError('skill.destination', d.skillDestinationId));
    }

    let owner = destination.skillMarketplace ?? destination.skillPlugin;
    if (destination.storageMode !== 'manifest' || !owner) {
      throw new ServiceError(
        badRequestError({ message: 'Only manifest destinations can be demoted.' })
      );
    }

    let demote = async () => {
      let runningSync = await db.skillDestinationSync.findFirst({
        where: { destinationOid: destination.oid, status: { in: [...runningSyncStatuses] } },
        select: { oid: true }
      });
      if (runningSync) {
        throw new ServiceError(
          badRequestError({ message: 'Wait for the running sync to finish before demoting.' })
        );
      }

      let tenant = await getOriginTenant({ oid: owner.projectOid });
      let codeBucket = await origin.codeBucket.create({
        tenantId: tenant.id,
        purpose: destination.skillPlugin?.isManaged
          ? 'cargo.skill.managed-plugin'
          : 'cargo.skill.destination',
        isReadOnly: false
      });

      return await withTransaction(async db => {
        let demoted = await db.skillDestination.update({
          where: { oid: destination.oid },
          data: {
            storageMode: 'code_bucket',
            storageModeChangedAt: new Date(),
            codeBucketId: codeBucket.id,
            currentManifestOid: null
          }
        });
        await db.skillDestinationItem.updateMany({
          where: { destinationOid: destination.oid },
          data: { hash: '' }
        });
        await convertSkillDestinationRowsToBucketPaths(destination.oid);
        await db.skillRepository.updateMany({
          where: {
            OR: [
              {
                marketplaceRepository: {
                  skillMarketplace: { destinationOid: destination.oid }
                }
              },
              { pluginRepository: { skillPlugin: { destinationOid: destination.oid } } }
            ]
          },
          data: {
            lastPropagatedManifestOid: null,
            dismissedManifestSha256: null,
            nextRepairAt: null,
            repairAttempts: 0,
            sourceRecoveryLimitWindows: 0,
            sourceRecoveryLimitReachedAt: null
          }
        });
        await forceSkillDestinationSync({ destination: demoted, trigger: 'migration' });

        return demoted;
      });
    };

    let latestSync = await db.skillDestinationSync.findFirst({
      where: { destinationOid: destination.oid },
      orderBy: { oid: 'desc' },
      select: { id: true }
    });

    let demoted: Awaited<ReturnType<typeof demote>> | undefined;
    if (latestSync) {
      await withDestinationSyncLock(async () => {
        demoted = await demote();
      })({ skillDestinationSyncId: latestSync.id });
    } else {
      demoted = await demote();
    }

    await Fabric.fire('skill.destination.audit.storage_demoted:after', {
      auditScope:
        d.auditScope ??
        createSystemAuditScope({
          organization: { oid: owner.organizationOid },
          instance: { oid: owner.instanceOid },
          job: 'cargo/skill/destination/demote-storage'
        }),
      skillDestination: demoted!,
      previousCodeBucketId: destination.codeBucketId
    });

    return demoted!;
  }
}

export let skillDestinationStorageService = Service.create(
  'cargoSkillDestinationStorageService',
  () => new SkillDestinationStorageServiceImpl()
).build();
