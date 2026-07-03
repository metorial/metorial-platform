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
let isUniqueConstraintError = (error: unknown) => (error as any)?.code === 'P2002';

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

      await tdb.ssoUserGroup.deleteMany({ where: { userOid: user.oid } });
      await tdb.ssoUserRole.deleteMany({ where: { userOid: user.oid } });

      if (ownerProfile.status === 'deprovisioned') return;

      for (let profileGroup of ownerProfile.groupLinks) {
        let { rootGroup } =
          profileGroup.group.rootGroup
            ? { rootGroup: profileGroup.group.rootGroup }
            : await ssoGroupRoleService.syncConnectionGroupRoot({
                group: profileGroup.group
              });

        try {
          await tdb.ssoUserGroup.create({
            data: {
              ...getId('ssoUserGroup'),
              userOid: user.oid,
              groupOid: rootGroup.oid
            }
          });
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
        }
      }

      for (let profileRole of ownerProfile.roleLinks) {
        let { rootRole } =
          profileRole.role.rootRole
            ? { rootRole: profileRole.role.rootRole }
            : await ssoGroupRoleService.syncConnectionRoleRoot({
                role: profileRole.role
              });

        try {
          await tdb.ssoUserRole.create({
            data: {
              ...getId('ssoUserRole'),
              userOid: user.oid,
              roleOid: rootRole.oid
            }
          });
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
        }
      }
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
