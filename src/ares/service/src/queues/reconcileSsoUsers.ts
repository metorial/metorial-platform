import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import {
  enqueueSsoUserChange,
  type SsoUserChangeSource
} from './recordSsoUserChanges';
import { ssoGroupRoleService } from '../services/sso/groupRole';

let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export let reconcileSsoUsersCron = createCron(
  {
    name: 'ares/sso/user/reconcile',
    cron: '0 * * * *',
    redisUrl
  },
  async () => {
    await reconcileSsoUsersQueue.add({});
  }
);

export let reconcileSsoUsersQueue = createQueue<{
  cursor?: string;
}>({
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
  workerOpts: { concurrency: 10 }
});

export let reconcileSsoUsersQueueProcessor = reconcileSsoUsersQueue.process(async data => {
  let users = await db.ssoUser.findMany({
    where: {
      ownerProfileOid: { not: null },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: 500
  });

  if (users.length === 0) return;

  await reconcileSingleSsoUserQueue.addManyWithOps(
    users.map(user => ({
      data: { ssoUserId: user.id, source: 'user_reconciled' },
      opts: { id: user.id }
    }))
  );

  await reconcileSsoUsersQueue.add({
    cursor: users[users.length - 1]!.id
  });
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

    // Sync group and role roots BEFORE transaction to avoid nested transaction lock contention
    let groupRoots: Map<string, { oid: bigint }> = new Map();
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

    let roleRoots: Map<string, { oid: bigint }> = new Map();
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
          status: ownerProfile.status === 'deprovisioned' ? 'deprovisioned' : 'active',
          email: ownerProfile.email,
          firstName: ownerProfile.firstName,
          lastName: ownerProfile.lastName
        }
      });

      if (ownerProfile.status === 'deprovisioned') {
        await tdb.ssoUserGroup.deleteMany({ where: { userOid: user.oid } });
        await tdb.ssoUserRole.deleteMany({ where: { userOid: user.oid } });
        return;
      }

      // Upserting on the membership pair keeps link ids stable across reconciles, which
      // downstream mirrors rely on to avoid unique constraint collisions.
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
