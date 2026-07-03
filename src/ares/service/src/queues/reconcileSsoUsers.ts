import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import { ssoService } from '../services/sso';

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
    take: 500
  });

  if (users.length === 0) return;

  await reconcileSingleSsoUserQueue.addManyWithOps(
    users.map(user => ({
      data: { ssoUserId: user.id },
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
        let rootGroup =
          profileGroup.group.rootGroup ??
          (await ssoService.upsertRootGroup({
            tenant: { oid: user.tenantOid },
            value: profileGroup.group.value,
            displayName: profileGroup.group.displayName,
            metadata: (profileGroup.group.metadata as Record<string, any> | null) ?? undefined
          }));

        if (!profileGroup.group.rootGroupOid) {
          await tdb.ssoConnectionGroup.update({
            where: { oid: profileGroup.group.oid },
            data: { rootGroupOid: rootGroup.oid }
          });
        }

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
        let rootRole =
          profileRole.role.rootRole ??
          (await ssoService.upsertRootRole({
            tenant: { oid: user.tenantOid },
            value: profileRole.role.value,
            displayName: profileRole.role.displayName,
            metadata: (profileRole.role.metadata as Record<string, any> | null) ?? undefined
          }));

        if (!profileRole.role.rootRoleOid) {
          await tdb.ssoConnectionRole.update({
            where: { oid: profileRole.role.oid },
            data: { rootRoleOid: rootRole.oid }
          });
        }

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
  }
);

export let reconcileSsoUsersProcessor = combineQueueProcessors([
  reconcileSsoUsersCron,
  reconcileSsoUsersQueueProcessor,
  reconcileSingleSsoUserQueueProcessor
]);
