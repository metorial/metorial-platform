import { notFoundError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import {
  ConsumerActor,
  ConsumerProfile,
  ConsumerSurfaceType,
  db,
  Instance,
  withTransaction
} from '@metorial/db';
import { createLock } from '@metorial/lock';
import {
  identityActorMirrorService,
  identityActorService,
  identityService
} from '@metorial-subspace/module-identity';
import { metorialResourceService } from '@metorial-subspace/module-tenant';
import { syncInstanceConsumerActorsQueue } from '../queues/consumerActorSync';

let defaultActorSurfacePriority: Record<ConsumerSurfaceType, number> = {
  portal: 0,
  cli: 1,
  organization_members: 2
};

let Sentry = getSentry();

let consumerActorLock = createLock({
  name: 'cons/ident/sync/actor'
});

let instanceConsumerActorLock = createLock({
  name: 'cons/ident/sync/instance-consumer'
});

let cleanupSubspaceResources = async (d: {
  instance: Instance;
  identityActorId?: string;
  identityId?: string;
}) => {
  if (d.identityId) {
    try {
      let identity = await identityService.getIdentityById({
        instance: d.instance,
        identityId: d.identityId,
        allowDeleted: false
      });
      await identityService.archiveIdentity({
        instance: d.instance,
        identity,
        canEditConsumerActor: true
      });
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  if (d.identityActorId) {
    try {
      let identityActor = await identityActorService.getIdentityActorById({
        instance: d.instance,
        identityActorId: d.identityActorId,
        allowDeleted: false
      });
      await identityActorService.archiveIdentityActor({
        instance: d.instance,
        identityActor,
        canEditConsumerActor: true
      });
    } catch (error) {
      Sentry.captureException(error);
    }
  }
};

class ConsumerActorServiceImpl {
  private async findHealthyDefaultActor(d: {
    instance: Pick<Instance, 'oid'>;
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
  }) {
    let actors = await db.consumerActor.findMany({
      where: {
        instanceOid: d.instance.oid,
        consumerProfileOid: d.consumerProfile.oid,
        isDefault: true
      },
      orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
      take: 2
    });

    if (actors.length === 1 && actors[0]!.defaultIdentityId) {
      return actors[0]!;
    }

    return null;
  }

  private async findHealthyDefaultActorOnPrimary(d: {
    instance: Pick<Instance, 'oid'>;
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
  }) {
    let actors = await withTransaction(async database =>
      database.consumerActor.findMany({
        where: {
          instanceOid: d.instance.oid,
          consumerProfileOid: d.consumerProfile.oid,
          isDefault: true
        },
        orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
        take: 2
      })
    );

    if (actors.length === 1 && actors[0]!.defaultIdentityId) {
      return actors[0]!;
    }

    return null;
  }

  private async createDefaultIdentity(d: {
    instance: Instance;
    consumerProfile: ConsumerProfile;
    actor: Pick<ConsumerActor, 'id'>;
    name: string;
    privateMetadata: Record<string, string>;
  }) {
    let identityActor = await identityActorService.getIdentityActorById({
      instance: d.instance,
      identityActorId: d.actor.id,
      allowDeleted: false
    });
    let identity = await identityService.createIdentity({
      instance: d.instance,
      actor: identityActor,
      input: {
        name: `Default Identity for ${d.name}`,
        inputs: [],
        privateMetadata: d.privateMetadata
      }
    });

    try {
      return await db.consumerActor.update({
        where: {
          id: d.actor.id,
          instanceOid: d.instance.oid,
          consumerProfileOid: d.consumerProfile.oid,
          isDefault: true
        },
        data: {
          defaultIdentityId: identity.id
        }
      });
    } catch (error) {
      await cleanupSubspaceResources({
        instance: d.instance,
        identityId: identity.id
      });

      let winner = await this.findHealthyDefaultActorOnPrimary(d);
      if (winner) return winner;
      throw error;
    }
  }

  async ensureDefaultConsumerActor(d: {
    instance: Instance;
    consumerProfile: Pick<ConsumerProfile, 'oid' | 'instanceOid'>;
  }): Promise<ConsumerActor> {
    if (d.consumerProfile.instanceOid !== d.instance.oid) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    let existingActor = await this.findHealthyDefaultActor(d);
    if (existingActor) return existingActor;

    return await consumerActorLock.usingLock(d.consumerProfile.oid.toString(), async () => {
      let { profile, instanceConsumer } = await withTransaction(async database => {
        let profile = await database.consumerProfile.findFirst({
          where: {
            oid: d.consumerProfile.oid,
            instanceOid: d.instance.oid,
            status: 'active'
          },
          include: {
            instance: true,
            consumer: true,
            actors: {
              where: { isDefault: true },
              orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
            }
          }
        });
        if (!profile) {
          throw new ServiceError(notFoundError('consumer.profile'));
        }

        let instanceConsumer = await database.instanceConsumer.findUnique({
          where: {
            instanceOid_consumerOid: {
              instanceOid: profile.instanceOid,
              consumerOid: profile.consumerOid
            }
          }
        });
        if (!instanceConsumer) {
          throw new ServiceError(notFoundError('consumer.instance_consumer'));
        }

        let [, ...duplicateActors] = profile.actors;
        if (duplicateActors.length) {
          await database.consumerActor.updateMany({
            where: {
              oid: { in: duplicateActors.map(actor => actor.oid) },
              consumerProfileOid: profile.oid,
              isDefault: true
            },
            data: { isDefault: false }
          });
        }

        return { profile, instanceConsumer };
      });

      let actor = profile.actors[0];

      let privateMetadata = {
        $owner: 'consumer',
        consumerProfileId: profile.id,
        instanceConsumerId: instanceConsumer.id,
        consumerId: profile.consumer.id
      };

      if (actor) {
        if (actor.defaultIdentityId) return actor;

        let actorWithIdentity = await this.createDefaultIdentity({
          instance: profile.instance,
          consumerProfile: profile,
          actor,
          name: instanceConsumer.name,
          privateMetadata
        });

        await syncInstanceConsumerActorsQueue.add({ instanceConsumerId: instanceConsumer.id });

        return actorWithIdentity;
      }

      await metorialResourceService.syncConsumerProfile(profile);

      let identityActor = await identityActorService.createIdentityActor({
        instance: profile.instance,
        consumerOwner: {
          consumerId: profile.consumer.id,
          instanceConsumerId: instanceConsumer.id,
          consumerProfileId: profile.id
        },
        input: {
          name: instanceConsumer.name,
          type: profile.organizationMemberOid ? 'organization_member' : 'consumer',
          privateMetadata
        }
      });

      let identity;
      try {
        identity = await identityService.createIdentity({
          instance: profile.instance,
          actor: identityActor,
          input: {
            name: `Default Identity for ${instanceConsumer.name}`,
            inputs: [],
            privateMetadata
          }
        });
      } catch (error) {
        await cleanupSubspaceResources({
          instance: profile.instance,
          identityActorId: identityActor.id
        });
        throw error;
      }

      let consumerActor: ConsumerActor;
      try {
        consumerActor = await db.consumerActor.create({
          data: {
            id: identityActor.id,
            instanceOid: profile.instanceOid,
            organizationOid: profile.organizationOid,
            consumerOid: profile.consumerOid,
            consumerProfileOid: profile.oid,
            instanceConsumerOid: instanceConsumer.oid,
            defaultIdentityId: identity.id,
            isDefault: true
          }
        });
      } catch (error) {
        let winner = await this.findHealthyDefaultActorOnPrimary({
          instance: profile.instance,
          consumerProfile: profile
        });

        await cleanupSubspaceResources({
          instance: profile.instance,
          identityActorId: identityActor.id,
          identityId: identity.id
        });

        if (winner) return winner;
        throw error;
      }

      await syncInstanceConsumerActorsQueue.add({ instanceConsumerId: instanceConsumer.id });

      return consumerActor;
    });
  }

  async syncInstanceConsumerActors(d: { instanceConsumerId: string }) {
    return await instanceConsumerActorLock.usingLock(d.instanceConsumerId, async () => {
      let instanceConsumer = await db.instanceConsumer.findUnique({
        where: { id: d.instanceConsumerId },
        include: {
          consumer: true,
          consumerActors: {
            include: {
              consumerProfile: { include: { surface: true } }
            },
            orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
          }
        }
      });
      if (!instanceConsumer) return null;

      let consumerProfiles = new Map(
        instanceConsumer.consumerActors.map(actor => [
          actor.consumerProfile.oid,
          actor.consumerProfile
        ])
      );
      for (let consumerProfile of consumerProfiles.values()) {
        await metorialResourceService.syncConsumerProfile(consumerProfile);
      }

      let linkedActors = [];
      for (let consumerActor of instanceConsumer.consumerActors) {
        let linked = await identityActorService.syncConsumerOwnershipInternal({
          identityActorId: consumerActor.id,
          owner: {
            consumerId: instanceConsumer.consumer.id,
            instanceConsumerId: instanceConsumer.id,
            consumerProfileId: consumerActor.consumerProfile.id
          },
          defaultIdentityId: consumerActor.defaultIdentityId
        });
        if (!linked) continue;

        if (linked.defaultIdentityId !== consumerActor.defaultIdentityId) {
          await db.consumerActor.update({
            where: { oid: consumerActor.oid },
            data: { defaultIdentityId: linked.defaultIdentityId }
          });
        }

        if (!consumerActor.identityActorOid) {
          await identityActorMirrorService.syncIdentityActor({
            identityActorId: consumerActor.id
          });
        }

        linkedActors.push({ consumerActor, identityActor: linked.identityActor });
      }

      let defaultActor = linkedActors
        .filter(
          ({ consumerActor, identityActor }) =>
            consumerActor.consumerProfile.status === 'active' &&
            identityActor.status === 'active'
        )
        .map(({ consumerActor }) => consumerActor)
        .sort(
          (a, b) =>
            defaultActorSurfacePriority[a.consumerProfile.surface.type] -
              defaultActorSurfacePriority[b.consumerProfile.surface.type] ||
            a.createdAt.getTime() - b.createdAt.getTime() ||
            (a.oid < b.oid ? -1 : 1)
        )[0];

      await withTransaction(async database => {
        await database.consumerActor.updateMany({
          where: {
            defaultForInstanceConsumerOid: instanceConsumer.oid,
            oid: defaultActor ? { not: defaultActor.oid } : undefined
          },
          data: { defaultForInstanceConsumerOid: null }
        });

        if (
          defaultActor &&
          defaultActor.defaultForInstanceConsumerOid !== instanceConsumer.oid
        ) {
          await database.consumerActor.update({
            where: { oid: defaultActor.oid },
            data: { defaultForInstanceConsumerOid: instanceConsumer.oid }
          });
        }
      });

      await identityActorService.setInstanceConsumerDefaultActorInternal({
        instanceConsumerId: instanceConsumer.id,
        identityActorId: defaultActor?.id ?? null
      });

      return defaultActor ?? null;
    });
  }

  async reconcileConsumerProfileActors(d: {
    instance: Instance;
    consumerProfile: Pick<ConsumerProfile, 'oid' | 'instanceOid'>;
    name: string;
  }) {
    let defaultActor = await this.ensureDefaultConsumerActor(d);

    let instanceConsumer = await db.instanceConsumer.findUniqueOrThrow({
      where: { oid: defaultActor.instanceConsumerOid },
      select: { id: true }
    });
    await syncInstanceConsumerActorsQueue.add({ instanceConsumerId: instanceConsumer.id });

    let actors = await withTransaction(async database =>
      database.consumerActor.findMany({
        where: {
          instanceOid: d.instance.oid,
          consumerProfileOid: d.consumerProfile.oid
        }
      })
    );

    await Promise.all(
      actors.map(async actor => {
        let identityActor = await identityActorService.getIdentityActorById({
          instance: d.instance,
          identityActorId: actor.id,
          allowDeleted: false
        });
        return identityActorService.updateIdentityActor({
          instance: d.instance,
          identityActor,
          input: { name: d.name },
          canEditConsumerActor: true
        });
      })
    );

    return defaultActor;
  }
}

export let consumerActorService = Service.create(
  'consumerActorService',
  () => new ConsumerActorServiceImpl()
).build();
