import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../db';
import { ssoGroupRoleService } from '../services/sso/groupRole';
import { reconcileSingleSsoUserQueue } from './reconcileSsoUsers';

let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export let reconcileSsoGroupRoleMembershipsCron = createCron(
  {
    name: 'ares/sso/grm/reconcile',
    cron: '0 * * * *',
    redisUrl
  },
  async () => {
    await reconcileSsoGroupRoleMembershipsQueue.add({});
  }
);

export let reconcileSsoGroupRoleMembershipsQueue = createQueue<{
  cursor?: string;
}>({
  name: 'ares/sso/grm/reconcileMany',
  redisUrl,
  workerOpts: { concurrency: 1 }
});

export let reconcileSingleSsoGroupRoleMembershipQueue = createQueue<{
  userProfileId: string;
}>({
  name: 'ares/sso/grm/reconcileSingle',
  redisUrl,
  workerOpts: { concurrency: 10 }
});

export let reconcileSsoGroupRoleMembershipsQueueProcessor =
  reconcileSsoGroupRoleMembershipsQueue.process(async data => {
    let profiles = await db.ssoUserProfile.findMany({
      where: {
        isGroupRoleMemberReconciled: false,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 500
    });
    if (profiles.length === 0) return;

    await reconcileSingleSsoGroupRoleMembershipQueue.addManyWithOps(
      profiles.map(profile => ({
        data: { userProfileId: profile.id },
        opts: { id: profile.id }
      }))
    );

    await reconcileSsoGroupRoleMembershipsQueue.add({
      cursor: profiles[profiles.length - 1]!.id
    });
  });

export let reconcileSingleSsoGroupRoleMembershipQueueProcessor =
  reconcileSingleSsoGroupRoleMembershipQueue.process(async data => {
    let profile = await db.ssoUserProfile.findUnique({
      where: { id: data.userProfileId },
      include: { connection: true, ownedUser: true }
    });

    if (!profile) return;
    if (profile.isGroupRoleMemberReconciled) return;

    if (!profile.connection) throw new QueueRetryError();

    await ssoGroupRoleService.replaceUserProfileGroups({
      connection: profile.connection,
      userProfile: profile,
      groups: profile.groups
    });
    await ssoGroupRoleService.replaceUserProfileRoles({
      connection: profile.connection,
      userProfile: profile,
      roles: profile.roles
    });

    await db.ssoUserProfile.update({
      where: { oid: profile.oid },
      data: { isGroupRoleMemberReconciled: true }
    });

    if (profile.ownedUser) {
      await reconcileSingleSsoUserQueue.add({
        ssoUserId: profile.ownedUser.id,
        source: 'profile_group_role_membership_reconciled'
      });
    }
  });

export let reconcileSsoGroupRoleMembershipsProcessor = combineQueueProcessors([
  reconcileSsoGroupRoleMembershipsCron,
  reconcileSsoGroupRoleMembershipsQueueProcessor,
  reconcileSingleSsoGroupRoleMembershipQueueProcessor
]);
