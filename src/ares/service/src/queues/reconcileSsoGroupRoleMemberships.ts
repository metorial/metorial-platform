import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../db';
import { ssoService } from '../services/sso';

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
      include: { connection: true }
    });

    if (!profile) return;
    if (profile.isGroupRoleMemberReconciled) return;

    if (!profile.connection) throw new QueueRetryError();

    await ssoService.replaceUserProfileGroups({
      connection: profile.connection,
      userProfile: profile,
      groups: profile.groups
    });
    await ssoService.replaceUserProfileRoles({
      connection: profile.connection,
      userProfile: profile,
      roles: profile.roles
    });

    await db.ssoUserProfile.update({
      where: { oid: profile.oid },
      data: { isGroupRoleMemberReconciled: true }
    });
  });

export let reconcileSsoGroupRoleMembershipsProcessor = combineQueueProcessors([
  reconcileSsoGroupRoleMembershipsCron,
  reconcileSsoGroupRoleMembershipsQueueProcessor,
  reconcileSingleSsoGroupRoleMembershipQueueProcessor
]);
