import { db, TransactionDB, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createLock } from '@metorial/lock';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { consumerUpdatedQueue } from './lifecycle/consumer';

export let reconcileUserConsumersQueue = createQueue<{ userId: string }>({
  name: 'cons/reconcileUser/many'
});

let reconcileUserConsumerQueue = createQueue<{
  userId: string;
  organizationId: string;
}>({
  name: 'cons/reconcileUser/single'
});

let reconcileUserConsumerLock = createLock({
  name: 'cons/reconcileUser/lock'
});

let getCandidateWhere = (user: {
  oid: bigint;
  email: string;
  globalProfileOid: bigint | null;
}) => ({
  OR: [
    { userOid: user.oid },
    { email: user.email, userOid: null },
    { organizationMember: { userOid: user.oid } },
    ...(user.globalProfileOid
      ? [{ globalProfileOid: user.globalProfileOid, userOid: null }]
      : [])
  ]
});

export let reconcileUserConsumersQueueProcessor = reconcileUserConsumersQueue.process(
  async data => {
    let user = await db.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new QueueRetryError();

    let organizations = await db.consumer.findMany({
      where: getCandidateWhere(user),
      distinct: ['organizationOid'],
      select: { organization: { select: { id: true } } }
    });

    await reconcileUserConsumerQueue.addManyWithOps(
      organizations.map(({ organization }) => ({
        data: { userId: user.id, organizationId: organization.id },
        opts: { id: `${user.id}-${organization.id}` }
      }))
    );
  }
);

let mergeInstanceConsumers = async (d: {
  db: TransactionDB;
  canonicalConsumerOid: bigint;
  duplicateConsumerOid: bigint;
}) => {
  let duplicateInstanceConsumers = await d.db.instanceConsumer.findMany({
    where: { consumerOid: d.duplicateConsumerOid }
  });

  for (let duplicate of duplicateInstanceConsumers) {
    let canonical = await d.db.instanceConsumer.findUnique({
      where: {
        instanceOid_consumerOid: {
          instanceOid: duplicate.instanceOid,
          consumerOid: d.canonicalConsumerOid
        }
      }
    });

    if (!canonical) {
      await d.db.instanceConsumer.update({
        where: { oid: duplicate.oid },
        data: { consumerOid: d.canonicalConsumerOid }
      });
      continue;
    }

    await d.db.consumerActor.updateMany({
      where: { instanceConsumerOid: duplicate.oid },
      data: {
        consumerOid: d.canonicalConsumerOid,
        instanceConsumerOid: canonical.oid
      }
    });
    await d.db.workspaceProfile.updateMany({
      where: { instanceConsumerOid: duplicate.oid },
      data: {
        consumerOid: d.canonicalConsumerOid,
        instanceConsumerOid: canonical.oid
      }
    });
    await d.db.instanceConsumer.delete({ where: { oid: duplicate.oid } });
  }
};

let mergeConsumerInvites = async (d: {
  db: TransactionDB;
  canonicalConsumerOid: bigint;
  duplicateConsumerOid: bigint;
}) => {
  let consumerInviteIds = new Set<string>();
  let duplicateInvites = await d.db.consumerInvite.findMany({
    where: { consumerOid: d.duplicateConsumerOid },
    include: { workspaceInvite: true },
    orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
  });

  for (let duplicateInvite of duplicateInvites) {
    let canonicalInvite = await d.db.consumerInvite.findFirst({
      where: {
        consumerOid: d.canonicalConsumerOid,
        surfaceOid: duplicateInvite.surfaceOid
      },
      include: { workspaceInvite: true }
    });

    if (!canonicalInvite) {
      await d.db.consumerInvite.update({
        where: { oid: duplicateInvite.oid },
        data: { consumerOid: d.canonicalConsumerOid }
      });
      consumerInviteIds.add(duplicateInvite.id);
      continue;
    }

    consumerInviteIds.add(canonicalInvite.id);

    await d.db.consumerInvite.update({
      where: { oid: canonicalInvite.oid },
      data: {
        status:
          canonicalInvite.status === 'accepted' || duplicateInvite.status === 'accepted'
            ? 'accepted'
            : 'pending',
        acceptedAt: canonicalInvite.acceptedAt ?? duplicateInvite.acceptedAt,
        message: canonicalInvite.message ?? duplicateInvite.message,
        expiresAt:
          canonicalInvite.expiresAt > duplicateInvite.expiresAt
            ? canonicalInvite.expiresAt
            : duplicateInvite.expiresAt
      }
    });

    if (duplicateInvite.workspaceInvite) {
      await d.db.workspaceInvite.update({
        where: { oid: duplicateInvite.workspaceInvite.oid },
        data: {
          consumerInviteOid: canonicalInvite.workspaceInvite ? null : canonicalInvite.oid
        }
      });
    }

    await d.db.consumerInvite.delete({ where: { oid: duplicateInvite.oid } });
  }

  return consumerInviteIds;
};

let mergeConsumer = async (d: {
  db: TransactionDB;
  canonicalConsumerOid: bigint;
  duplicateConsumerOid: bigint;
}) => {
  await mergeInstanceConsumers(d);
  let consumerInviteIds = await mergeConsumerInvites(d);
  let consumerProfiles = await d.db.consumerProfile.findMany({
    where: { consumerOid: d.duplicateConsumerOid },
    select: { id: true }
  });

  await Promise.all([
    d.db.consumerProfile.updateMany({
      where: { consumerOid: d.duplicateConsumerOid },
      data: { consumerOid: d.canonicalConsumerOid }
    }),
    d.db.consumerActor.updateMany({
      where: { consumerOid: d.duplicateConsumerOid },
      data: { consumerOid: d.canonicalConsumerOid }
    }),
    d.db.consumerToken.updateMany({
      where: { consumerOid: d.duplicateConsumerOid },
      data: { consumerOid: d.canonicalConsumerOid }
    }),
    d.db.consumerIntegration.updateMany({
      where: { consumerOid: d.duplicateConsumerOid },
      data: { consumerOid: d.canonicalConsumerOid }
    }),
    d.db.consumerIntegrationEndpoint.updateMany({
      where: { consumerOid: d.duplicateConsumerOid },
      data: { consumerOid: d.canonicalConsumerOid }
    }),
    d.db.consumerIntegrationSession.updateMany({
      where: { consumerOid: d.duplicateConsumerOid },
      data: { consumerOid: d.canonicalConsumerOid }
    }),
    d.db.consumerSkill.updateMany({
      where: { consumerOid: d.duplicateConsumerOid },
      data: { consumerOid: d.canonicalConsumerOid }
    }),
    d.db.workspaceProfile.updateMany({
      where: { consumerOid: d.duplicateConsumerOid },
      data: { consumerOid: d.canonicalConsumerOid }
    }),
    d.db.resourceActor.updateMany({
      where: { consumerOid: d.duplicateConsumerOid },
      data: { consumerOid: d.canonicalConsumerOid }
    }),
    d.db.skill.updateMany({
      where: { createdByConsumerOid: d.duplicateConsumerOid },
      data: { createdByConsumerOid: d.canonicalConsumerOid }
    })
  ]);

  await d.db.consumer.delete({ where: { oid: d.duplicateConsumerOid } });

  return {
    consumerProfileIds: new Set(consumerProfiles.map(profile => profile.id)),
    consumerInviteIds
  };
};

export let reconcileUserConsumerQueueProcessor = reconcileUserConsumerQueue.process(
  async data =>
    reconcileUserConsumerLock.usingLock(`${data.userId}:${data.organizationId}`, async () => {
      let user = await db.user.findUnique({ where: { id: data.userId } });
      if (!user) throw new QueueRetryError();

      let deletedConsumerIds: string[] = [];
      let consumerProfileIds = new Set<string>();
      let consumerInviteIds = new Set<string>();
      let reconciliation = await withTransaction(async db => {
        let consumers = await db.consumer.findMany({
          where: {
            organization: { id: data.organizationId },
            ...getCandidateWhere(user)
          },
          include: {
            organizationMember: true
          },
          orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
        });
        if (!consumers.length) return null;

        let canonical =
          consumers.find(consumer => consumer.userOid === user.oid) ??
          consumers.find(consumer => consumer.organizationMember?.userOid === user.oid) ??
          consumers.find(consumer => consumer.email === user.email) ??
          consumers[0]!;
        let duplicates = consumers.filter(consumer => consumer.oid !== canonical.oid);

        for (let duplicate of duplicates) {
          let merged = await mergeConsumer({
            db,
            canonicalConsumerOid: canonical.oid,
            duplicateConsumerOid: duplicate.oid
          });
          for (let consumerProfileId of merged.consumerProfileIds) {
            consumerProfileIds.add(consumerProfileId);
          }
          for (let consumerInviteId of merged.consumerInviteIds) {
            consumerInviteIds.add(consumerInviteId);
          }
          deletedConsumerIds.push(duplicate.id);
        }

        let consumer = await db.consumer.update({
          where: { oid: canonical.oid },
          data: {
            userOid: user.oid,
            globalProfileOid: user.globalProfileOid ?? canonical.globalProfileOid,
            name: user.name,
            email: user.type === 'system' ? canonical.email : user.email,
            organizationMemberOid:
              canonical.organizationMemberOid ??
              consumers.find(consumer => consumer.organizationMemberOid)
                ?.organizationMemberOid,
            organizationActorOid:
              canonical.organizationActorOid ??
              consumers.find(consumer => consumer.organizationActorOid)?.organizationActorOid,
            isOrganizationMember: consumers.some(consumer => consumer.isOrganizationMember),
            isPortalConsumer: consumers.some(consumer => consumer.isPortalConsumer),
            isManuallyCreated: consumers.some(consumer => consumer.isManuallyCreated),
            isPending: consumers.every(consumer => consumer.isPending)
          }
        });

        return { consumer };
      });

      for (let consumerId of deletedConsumerIds) {
        await Fabric.fire('consumer.deleted:after', { consumerId });
      }

      if (consumerProfileIds.size) {
        let consumerProfiles = await db.consumerProfile.findMany({
          where: { id: { in: Array.from(consumerProfileIds) } },
          include: { surface: true }
        });
        for (let consumerProfile of consumerProfiles) {
          await Fabric.fire('consumer.profile.updated:after', {
            consumerProfile,
            surface: consumerProfile.surface
          });
        }
      }

      if (consumerInviteIds.size) {
        let consumerInvites = await db.consumerInvite.findMany({
          where: { id: { in: Array.from(consumerInviteIds) } },
          include: {
            consumerProfile: true,
            invitedBy: true,
            surface: true
          }
        });
        for (let consumerInvite of consumerInvites) {
          await Fabric.fire('consumer.invite.updated:after', {
            consumerInvite,
            consumerProfile: consumerInvite.consumerProfile,
            consumerSurface: consumerInvite.surface,
            performedBy: consumerInvite.invitedBy
          });
        }
      }

      if (reconciliation) {
        await consumerUpdatedQueue.add({ consumerId: reconciliation.consumer.id });
      }
    })
);

export let reconcileUserConsumers = (d: { userId: string }) =>
  reconcileUserConsumersQueue.add(d);
