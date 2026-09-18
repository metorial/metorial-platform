import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import {
  commitWatermarkScan,
  createQueueCheckpoint,
  isFullPassDue,
  startWatermarkScan,
  type WatermarkScanJob
} from '@lowerdeck/queue-checkpoint';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import { ssoGroupRoleService } from '../services/sso/groupRole';
import { enqueueSsoUserChange, type SsoUserChangeSource } from './recordSsoUserChanges';

let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let RECONCILE_SSO_USERS_BATCH_SIZE = 500;

let checkpoint = createQueueCheckpoint({
  db,
  queue: 'ares/sso/user/reconcile'
});

export let reconcileSsoUsersCron = createCron(
  {
    name: 'ares/sso/user/reconcile',
    cron: '0 * * * *',
    redisUrl
  },
  async () => {
    await reconcileSsoUsersQueue.add(
      await startWatermarkScan({ checkpoint, full: isFullPassDue() })
    );
  }
);

export let reconcileSsoUsersQueue = createQueue<WatermarkScanJob>({
  name: 'ares/sso/user/reconcileMany',
  redisUrl,
  workerOpts: { concurrency: 1 }
});

export let reconcileSingleSsoUserQueue = createQueue<{
  ssoUserId: string;
  source?: SsoUserChangeSource;
  scimOperationId?: string;
}>({
  name: 'ares/sso/user/reconcileSingle',
  redisUrl,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let reconcileSsoUsersQueueProcessor = reconcileSsoUsersQueue.process(async job => {
  let users = await db.ssoUser.findMany({
    where: {
      ownerProfileOid: { not: null },
      ...(job.since ? { ownerProfile: { updatedAt: { gte: new Date(job.since) } } } : {}),
      id: job.cursor ? { gt: job.cursor } : undefined
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: RECONCILE_SSO_USERS_BATCH_SIZE
  });

  if (users.length) {
    await reconcileSingleSsoUserQueue.addManyWithOps(
      users.map(user => ({
        data: { ssoUserId: user.id, source: 'user_reconciled' as const },
        opts: { id: user.id }
      }))
    );
  }

  if (users.length === RECONCILE_SSO_USERS_BATCH_SIZE) {
    await reconcileSsoUsersQueue.add(
      { ...job, cursor: users[users.length - 1]!.id },
      hourlyPacedDelay()
    );
    return;
  }

  await commitWatermarkScan({ checkpoint, job });
});

export let reconcileSingleSsoUserQueueProcessor = reconcileSingleSsoUserQueue.process(
  async data => {
    let user = await db.ssoUser.findUnique({
      where: { id: data.ssoUserId },
      include: {
        ownerProfile: {
          include: {
            groupLinks: { include: { group: { include: { rootGroup: true } } } },
            roleLinks: { include: { role: { include: { rootRole: true } } } }
          }
        }
      }
    });

    if (!user) return;
    if (!user.ownerProfile) return;

    let ownerProfile = user.ownerProfile;

    if (ownerProfile.status === 'deprovisioned') {
      await withTransaction(async tdb => {
        await tdb.ssoUser.update({
          where: { oid: user.oid },
          data: {
            status: 'deprovisioned',
            email: ownerProfile.email,
            firstName: ownerProfile.firstName,
            lastName: ownerProfile.lastName
          }
        });
        await tdb.ssoUserGroup.deleteMany({ where: { userOid: user.oid } });
        await tdb.ssoUserRole.deleteMany({ where: { userOid: user.oid } });
      });
      return;
    }

    let groupRoots: Map<bigint, { oid: bigint }> = new Map();
    for (let profileGroup of ownerProfile.groupLinks) {
      if (profileGroup.group.rootGroup) {
        groupRoots.set(profileGroup.group.oid, profileGroup.group.rootGroup);
      } else {
        let { rootGroup } = await ssoGroupRoleService.syncConnectionGroupRoot({
          group: profileGroup.group
        });
        groupRoots.set(profileGroup.group.oid, rootGroup);
      }
    }

    let roleRoots: Map<bigint, { oid: bigint }> = new Map();
    for (let profileRole of ownerProfile.roleLinks) {
      if (profileRole.role.rootRole) {
        roleRoots.set(profileRole.role.oid, profileRole.role.rootRole);
      } else {
        let { rootRole } = await ssoGroupRoleService.syncConnectionRoleRoot({
          role: profileRole.role
        });
        roleRoots.set(profileRole.role.oid, rootRole);
      }
    }

    await withTransaction(async tdb => {
      await tdb.ssoUser.update({
        where: { oid: user.oid },
        data: {
          status: 'active',
          email: ownerProfile.email,
          firstName: ownerProfile.firstName,
          lastName: ownerProfile.lastName
        }
      });

      let groupOids: bigint[] = [];
      for (let profileGroup of ownerProfile.groupLinks) {
        let rootGroup = groupRoots.get(profileGroup.group.oid)!;
        groupOids.push(rootGroup.oid);

        await tdb.ssoUserGroup.upsert({
          where: { userOid_groupOid: { userOid: user.oid, groupOid: rootGroup.oid } },
          create: {
            ...getId('ssoUserGroup'),
            userOid: user.oid,
            groupOid: rootGroup.oid
          },
          update: {}
        });
      }

      await tdb.ssoUserGroup.deleteMany({
        where: { userOid: user.oid, groupOid: { notIn: groupOids } }
      });

      let roleOids: bigint[] = [];
      for (let profileRole of ownerProfile.roleLinks) {
        let rootRole = roleRoots.get(profileRole.role.oid)!;
        roleOids.push(rootRole.oid);

        await tdb.ssoUserRole.upsert({
          where: { userOid_roleOid: { userOid: user.oid, roleOid: rootRole.oid } },
          create: {
            ...getId('ssoUserRole'),
            userOid: user.oid,
            roleOid: rootRole.oid
          },
          update: {}
        });
      }

      await tdb.ssoUserRole.deleteMany({
        where: { userOid: user.oid, roleOid: { notIn: roleOids } }
      });
    });

    await enqueueSsoUserChange({
      ssoUserId: user.id,
      source: data.source ?? 'user_reconciled',
      scimOperationId: data.scimOperationId
    });
  }
);

export let reconcileSsoUsersProcessor = combineQueueProcessors([
  reconcileSsoUsersCron,
  reconcileSsoUsersQueueProcessor,
  reconcileSingleSsoUserQueueProcessor
]);
