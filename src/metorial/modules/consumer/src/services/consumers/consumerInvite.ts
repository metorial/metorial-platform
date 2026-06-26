import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { ConsumerSurface, db, ID, OrganizationActor, Prisma } from '@metorial/db';
import { searchConsumerIds } from '@metorial/module-search';
import {
  consumerInviteCreatedQueue,
  consumerInviteUpdatedQueue
} from '../../queues/lifecycle/consumerInvite';
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

let normalizeEmailFilter = (emails?: string[]) => {
  let normalizedEmails = (emails ?? [])
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  if (!normalizedEmails.length) return undefined;

  return Array.from(new Set(normalizedEmails));
};

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

    let existingInvite = await db.consumerInvite.findUnique({
      where: {
        consumerProfileOid: consumerProfile.oid
      },
      select: {
        id: true
      }
    });
    let invite = existingInvite
      ? await db.consumerInvite.update({
          where: {
            consumerProfileOid: consumerProfile.oid
          },
          data: {
            status: 'pending',
            message: d.input.message,
            invitedByOid: d.performedBy.oid,
            acceptedAt: null
          },
          include
        })
      : await db.consumerInvite.create({
          data: {
            id: await ID.generateId('consumerInvite'),
            status: 'pending',
            message: d.input.message,
            organizationOid: d.consumerSurface.organizationOid,
            instanceOid: d.consumerSurface.instanceOid,
            surfaceOid: d.consumerSurface.oid,
            consumerOid: consumerProfile.consumerOid,
            consumerProfileOid: consumerProfile.oid,
            invitedByOid: d.performedBy.oid
          },
          include
        });

    if (existingInvite) {
      await consumerInviteUpdatedQueue.add({ consumerInviteId: invite.id });
    } else {
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

  async listConsumerInvites(d: {
    consumerSurface: ConsumerSurface;
    search?: string;
    emails?: string[];
    statuses?: string[];
  }) {
    let search = d.search?.trim();
    let emails = normalizeEmailFilter(d.emails);
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
