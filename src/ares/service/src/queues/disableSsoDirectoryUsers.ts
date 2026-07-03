import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../db';
import { ssoGroupRoleService } from '../services/sso/groupRole';
import { reconcileSingleSsoUserQueue } from './reconcileSsoUsers';

let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export let disableSsoDirectoryUsersQueue = createQueue<{
  directoryId: string;
  cursor?: string;
}>({
  name: 'ares/sso/directory/disableMany',
  redisUrl,
  workerOpts: { concurrency: 1 }
});

export let disableSingleSsoDirectoryUserQueue = createQueue<{
  directoryUserProfileId: string;
}>({
  name: 'ares/sso/directory/disableSingle',
  redisUrl,
  workerOpts: { concurrency: 10 }
});

export let enqueueDisableSsoDirectoryUsers = async (d: { directoryId: string }) => {
  await disableSsoDirectoryUsersQueue.addManyWithOps([
    {
      data: {
        directoryId: d.directoryId
      },
      opts: { id: `directory:${d.directoryId}` }
    }
  ]);
};

export let disableSsoDirectoryUsersQueueProcessor = disableSsoDirectoryUsersQueue.process(
  async data => {
    let links = await db.ssoDirectoryUserProfile.findMany({
      where: {
        directory: {
          id: data.directoryId
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 500
    });
    if (links.length === 0) return;

    await disableSingleSsoDirectoryUserQueue.addManyWithOps(
      links.map(link => ({
        data: { directoryUserProfileId: link.id },
        opts: { id: link.id }
      }))
    );

    await disableSsoDirectoryUsersQueue.add({
      directoryId: data.directoryId,
      cursor: links[links.length - 1]!.id
    });
  }
);

export let disableSingleSsoDirectoryUserQueueProcessor =
  disableSingleSsoDirectoryUserQueue.process(async data => {
    let link = await db.ssoDirectoryUserProfile.findUnique({
      where: { id: data.directoryUserProfileId },
      include: {
        directory: true,
        userProfile: {
          include: {
            connection: true,
            ownedUser: true
          }
        }
      }
    });
    if (!link) return;

    await db.ssoDirectoryUserProfile.update({
      where: { oid: link.oid },
      data: { deprovisionedAt: new Date() }
    });

    if (link.userProfile.ownerDirectoryOid !== link.directoryOid) return;
    if (!link.userProfile.connection) throw new QueueRetryError();

    await db.ssoUserProfile.update({
      where: { oid: link.userProfile.oid },
      data: {
        ownerDirectoryOid: null,
        status: 'deprovisioned',
        groups: [],
        roles: [],
        isGroupRoleMemberReconciled: true
      }
    });

    await ssoGroupRoleService.replaceUserProfileGroups({
      connection: link.userProfile.connection,
      userProfile: link.userProfile,
      groups: []
    });
    await ssoGroupRoleService.replaceUserProfileRoles({
      connection: link.userProfile.connection,
      userProfile: link.userProfile,
      roles: []
    });

    if (!link.userProfile.ownedUser) return;

    await reconcileSingleSsoUserQueue.add({
      ssoUserId: link.userProfile.ownedUser.id,
      source: 'directory_disabled'
    });
  });

export let disableSsoDirectoryUsersProcessor = combineQueueProcessors([
  disableSsoDirectoryUsersQueueProcessor,
  disableSingleSsoDirectoryUserQueueProcessor
]);
