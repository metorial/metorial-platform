import {
  ConsumerProfile,
  ConsumerServerRequest,
  ConsumerServerRequestStatus,
  ConsumerSurface,
  db,
  ID,
  Server,
  ServerDeploymentTemplate,
  withTransaction
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { subDays } from 'date-fns';
import { sendAcceptEmail } from '../email/accept';
import { sendRejectEmail } from '../email/reject';
import { consumerAccessService } from './consumerAccess';

let include = {
  server: true,
  consumerProfile: true
};

class consumerServerRequestServiceImpl {
  async createConsumerServerRequest(d: {
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    server: Server;
    input: {
      reason: string;
    };
  }) {
    let existingRequest = await db.consumerServerRequest.findFirst({
      where: {
        consumerSurfaceOid: d.consumerSurface.oid,
        consumerProfileOid: d.consumerProfile.oid,
        serverOid: d.server.oid,
        status: 'pending',
        createdAt: {
          gt: subDays(new Date(), 10)
        }
      },
      include
    });
    if (existingRequest) {
      await db.consumerServerRequest.update({
        where: { oid: existingRequest.oid },
        data: {
          requestReason: d.input.reason
        }
      });

      return existingRequest;
    }

    return await db.consumerServerRequest.create({
      data: {
        id: await ID.generateId('consumerServerRequest'),
        consumerSurfaceOid: d.consumerSurface.oid,
        consumerProfileOid: d.consumerProfile.oid,
        serverOid: d.server.oid,
        requestReason: d.input.reason,
        status: 'pending'
      },
      include
    });
  }

  async rejectConsumerServerRequest(d: {
    consumerServerRequest: ConsumerServerRequest;
    input: {
      reason: string;
    };
  }) {
    if (d.consumerServerRequest.status !== 'pending') {
      throw new ServiceError(
        badRequestError({
          message: 'Only pending requests can be rejected.'
        })
      );
    }

    let req = await db.consumerServerRequest.update({
      where: { oid: d.consumerServerRequest.oid },
      data: {
        status: 'rejected',
        rejectReason: d.input.reason
      },
      include
    });

    await sendRejectEmail.send({
      data: {
        server: req.server,
        rejectReason: d.input.reason
      },
      to: [req.consumerProfile.email]
    });

    return req;
  }

  async acceptConsumerServerRequest(d: {
    consumerServerRequest: ConsumerServerRequest;
    serverDeploymentTemplate: ServerDeploymentTemplate;
  }) {
    if (d.consumerServerRequest.status !== 'pending') {
      throw new ServiceError(
        badRequestError({
          message: 'Only pending requests can be accepted.'
        })
      );
    }

    if (d.consumerServerRequest.serverOid != d.serverDeploymentTemplate.serverOid) {
      throw new ServiceError(
        badRequestError({
          message: 'The server deployment template does not belong to the requested server.'
        })
      );
    }

    return await withTransaction(async db => {
      let consumerProfile = await db.consumerProfile.findUniqueOrThrow({
        where: { oid: d.consumerServerRequest.consumerProfileOid },
        include: { personalConsumerGroup: true, surface: true }
      });

      await consumerAccessService.createConsumerAccess({
        consumerSurface: consumerProfile.surface,
        consumerGroup: consumerProfile.personalConsumerGroup!,
        access: {
          type: 'server_deployment_template',
          serverDeploymentTemplate: d.serverDeploymentTemplate
        }
      });

      let req = await db.consumerServerRequest.update({
        where: { oid: d.consumerServerRequest.oid },
        data: {
          status: 'approved'
        },
        include
      });

      await sendAcceptEmail.send({
        data: {
          server: req.server
        },
        to: [req.consumerProfile.email]
      });

      return req;
    });
  }

  async getConsumerServerRequestById(d: {
    consumerSurface: ConsumerSurface;
    consumerServerRequestId: string;
    consumerProfile?: ConsumerProfile;
  }) {
    let consumerServerRequest = await db.consumerServerRequest.findFirst({
      where: {
        id: d.consumerServerRequestId,
        consumerSurfaceOid: d.consumerSurface.oid,
        consumerProfileOid: d.consumerProfile?.oid
      },
      include
    });
    if (!consumerServerRequest) throw new ServiceError(notFoundError('consumer.surface'));
    return consumerServerRequest;
  }

  async listConsumerServerRequests(d: {
    consumerSurface: ConsumerSurface;
    status?: ConsumerServerRequestStatus[];
    consumerProfileIds?: string[];
    serverIds?: string[];
  }) {
    let consumerProfiles = d.consumerProfileIds
      ? await db.consumerProfile.findMany({
          where: {
            id: { in: d.consumerProfileIds.map(id => id) }
          },
          select: { oid: true }
        })
      : undefined;
    let servers = d.serverIds
      ? await db.server.findMany({
          where: {
            id: { in: d.serverIds.map(id => id) }
          },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.consumerServerRequest.findMany({
            ...opts,
            where: {
              consumerSurfaceOid: d.consumerSurface.oid,
              status: d.status ? { in: d.status } : undefined,

              consumerProfileOid: consumerProfiles
                ? { in: consumerProfiles.map(cp => cp.oid) }
                : undefined,

              serverOid: servers ? { in: servers.map(s => s.oid) } : undefined
            },
            include
          })
      )
    );
  }
}

export let consumerServerRequestService = Service.create(
  'consumerServerRequestService',
  () => new consumerServerRequestServiceImpl()
).build();
