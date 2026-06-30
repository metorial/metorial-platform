import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { GlobalProfile, GlobalProfileEmail } from '../../db';

type GlobalProfileWithEmails = GlobalProfile & {
  emails: GlobalProfileEmail[];
};

let getLatestTimestamp = (globalProfile: GlobalProfileWithEmails) => {
  return new Date(
    Math.max(
      globalProfile.updatedAt.getTime(),
      ...globalProfile.emails.map(email =>
        Math.max(email.createdAt.getTime(), email.updatedAt.getTime())
      )
    )
  );
};

export let syncGlobalProfileToDeploymentQueue = createQueue<{
  globalProfile: GlobalProfileWithEmails;
}>({
  name: 'global/sync/to-deployment/global-profile'
});

export let syncGlobalProfileToDeploymentQueueProcessor =
  syncGlobalProfileToDeploymentQueue.process(async data => {
    let globalProfile = data.globalProfile;

    let currentGlobalProfile = await db.globalProfile.findUnique({
      where: { id: globalProfile.id },
      include: { emails: true }
    });

    if (currentGlobalProfile) {
      let currentLatestTimestamp = getLatestTimestamp(currentGlobalProfile);
      let incomingLatestTimestamp = getLatestTimestamp(globalProfile);
      if (currentLatestTimestamp > incomingLatestTimestamp) return;
    }

    await db.$transaction(async tx => {
      await tx.globalProfile.upsert({
        where: { id: globalProfile.id },
        update: {
          oid: globalProfile.oid,
          name: globalProfile.name,
          createdAt: globalProfile.createdAt,
          updatedAt: globalProfile.updatedAt
        },
        create: {
          oid: globalProfile.oid,
          id: globalProfile.id,
          name: globalProfile.name,
          createdAt: globalProfile.createdAt,
          updatedAt: globalProfile.updatedAt
        }
      });

      if (globalProfile.emails.length === 0) {
        await tx.globalProfileEmail.deleteMany({
          where: { globalProfileOid: globalProfile.oid }
        });
      } else {
        await tx.globalProfileEmail.deleteMany({
          where: {
            globalProfileOid: globalProfile.oid,
            id: { notIn: globalProfile.emails.map(email => email.id) }
          }
        });
      }

      for (let email of globalProfile.emails) {
        await tx.globalProfileEmail.upsert({
          where: { id: email.id },
          update: {
            oid: email.oid,
            email: email.email,
            globalProfileOid: globalProfile.oid,
            createdAt: email.createdAt,
            updatedAt: email.updatedAt
          },
          create: {
            oid: email.oid,
            id: email.id,
            email: email.email,
            globalProfileOid: globalProfile.oid,
            createdAt: email.createdAt,
            updatedAt: email.updatedAt
          }
        });
      }
    });
  });
