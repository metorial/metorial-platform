import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  ConsumerSurface,
  db,
  ID,
  OrganizationActor,
  Prisma,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { searchConsumerIds } from '@metorial/module-search';
import { addDays } from 'date-fns';
import { normalizeConsumerEmails } from '../lib/consumerEmail';
import {
  consumerInviteCreatedQueue,
  consumerInviteUpdatedQueue
} from '../queues/lifecycle/consumerInvite';
import { consumerProfileService } from './consumerProfile';

let include = {
  consumerProfile: true,
  invitedBy: true,
  surface: {
    include: {
      portal: true
    }
  }
} as const;

class ConsumerInviteServiceImpl {
  async inviteConsumer(d: {
    consumerSurface: ConsumerSurface;
    performedBy: OrganizationActor;
    input: {
      name: string;
      email: string;
      message?: string;
    };
  }) {
    let consumerProfile = await consumerProfileService.ensureConsumerProfile({
      surface: d.consumerSurface,
      email: d.input.email,
      name: d.input.name,
      inviteStatus: 'invited',
      rejectIfActiveProfileExists: true
    });

    let { invite, existingInvite } = await withTransaction(async db => {
      let existingInvite = await db.consumerInvite.findUnique({
        where: {
          consumerProfileOid: consumerProfile.oid
        },
        select: {
          id: true,
          oid: true
        }
      });

      if (existingInvite) {
        await Fabric.fire('consumer.invite.updated:before', {
          consumerProfile,
          consumerSurface: d.consumerSurface,
          performedBy: d.performedBy,
          consumerInviteId: existingInvite.id
        });
      } else {
        await Fabric.fire('consumer.invite.created:before', {
          consumerProfile,
          consumerSurface: d.consumerSurface,
          performedBy: d.performedBy
        });
      }

      let invite = existingInvite
        ? await db.consumerInvite.update({
            where: {
              consumerProfileOid: consumerProfile.oid
            },
            data: {
              status: 'pending',
              message: d.input.message,
              invitedByOid: d.performedBy.oid,
              acceptedAt: null,
              expiresAt: addDays(new Date(), 14)
            },
            include
          })
        : await db.consumerInvite.create({
            data: {
              id: await ID.generateId('consumerInvite'),
              status: 'pending',
              message: d.input.message,
              expiresAt: addDays(new Date(), 14),
              organizationOid: d.consumerSurface.organizationOid,
              instanceOid: d.consumerSurface.instanceOid,
              surfaceOid: d.consumerSurface.oid,
              consumerOid: consumerProfile.consumerOid,
              consumerProfileOid: consumerProfile.oid,
              invitedByOid: d.performedBy.oid
            },
            include
          });

      return { invite, existingInvite };
    });

    if (existingInvite) {
      await Fabric.fire('consumer.invite.updated:after', {
        consumerInvite: invite,
        consumerProfile,
        consumerSurface: d.consumerSurface,
        performedBy: d.performedBy
      });
      await consumerInviteUpdatedQueue.add({ consumerInviteId: invite.id });
    } else {
      await Fabric.fire('consumer.invite.created:after', {
        consumerInvite: invite,
        consumerProfile,
        consumerSurface: d.consumerSurface,
        performedBy: d.performedBy
      });
      await consumerInviteCreatedQueue.add({ consumerInviteId: invite.id });
    }

    return invite;
  }

  async getConsumerInviteById(d: {
    consumerSurface: ConsumerSurface;
    consumerInviteId: string;
  }) {
    let consumerInvite = await db.consumerInvite.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        id: d.consumerInviteId
      },
      include
    });
    if (!consumerInvite) {
      throw new ServiceError(notFoundError('consumer.invite'));
    }

    return consumerInvite;
  }

  async deleteConsumerInvite(d: {
    consumerSurface: ConsumerSurface;
    consumerInviteId: string;
  }) {
    let consumerInvite = await db.consumerInvite.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        id: d.consumerInviteId
      },
      include
    });
    if (!consumerInvite) {
      throw new ServiceError(notFoundError('consumer.invite'));
    }

    if (consumerInvite.status !== 'pending') {
      throw new ServiceError(notFoundError('consumer.invite'));
    }

    await db.consumerInvite.delete({
      where: {
        oid: consumerInvite.oid
      }
    });

    return consumerInvite;
  }

  async listConsumerInvites(d: {
    consumerSurface: ConsumerSurface;
    search?: string;
    emails?: string[];
    statuses?: string[];
  }) {
    let search = d.search?.trim();
    let emails = normalizeConsumerEmails(d.emails);
    let statuses = d.statuses?.length
      ? Array.from(new Set(d.statuses)).filter(
          (status): status is 'pending' | 'accepted' =>
            status == 'pending' || status == 'accepted'
        )
      : undefined;
    let instance = search
      ? await db.instance.findFirst({
          where: {
            oid: d.consumerSurface.instanceOid
          },
          select: {
            id: true
          }
        })
      : null;
    let searchedConsumerIds =
      search && instance
        ? await searchConsumerIds({
            instanceId: instance.id,
            query: search
          })
        : undefined;
    let searchedConsumerOids =
      search && searchedConsumerIds?.length
        ? (
            await db.instanceConsumer.findMany({
              where: {
                instanceOid: d.consumerSurface.instanceOid,
                id: { in: searchedConsumerIds }
              },
              select: { consumerOid: true },
              distinct: ['consumerOid']
            })
          ).map(consumer => consumer.consumerOid)
        : search
          ? []
          : undefined;
    let andParts: Prisma.ConsumerInviteWhereInput[] = [{ surfaceOid: d.consumerSurface.oid }];

    if (statuses?.length) {
      andParts.push({
        status: {
          in: statuses
        }
      });
    }

    if (emails?.length) {
      andParts.push({
        consumerProfile: {
          status: 'active',
          email: {
            in: emails
          }
        }
      });
    }

    if (search) {
      andParts.push({
        consumerOid: {
          in: searchedConsumerOids ?? []
        }
      });
    }

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerInvite.findMany({
          ...opts,
          where: {
            AND: andParts
          },
          include
        });
      })
    );
  }
}

export let consumerInviteService = Service.create(
  'consumerInviteService',
  () => new ConsumerInviteServiceImpl()
).build();
