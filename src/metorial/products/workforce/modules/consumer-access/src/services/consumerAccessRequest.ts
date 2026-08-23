import {
  conflictError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  ConsumerAccessRequest,
  ConsumerAccessRequestStatus,
  ConsumerGroup,
  ConsumerProfile,
  ConsumerSurface,
  db,
  ID,
  MagicMcpServer,
  Organization,
  Prisma,
  ProviderTemplate,
  withTransaction
} from '@metorial/db';
import { searchConsumerAccessRequestIds, searchConsumerIds } from '@metorial/module-search';
import { isPreconfiguredMagicMcpServer } from '../lib/magicMcpServerSource';
import {
  consumerAccessRequestCreatedQueue,
  consumerAccessRequestUpdatedQueue
} from '../queues/lifecycle/consumerAccessRequest';

let include = {
  surface: true,
  consumerProfile: {
    include: {
      consumer: true,
      personalConsumerGroup: true
    }
  },
  providerTemplate: true,
  magicMcpServer: true
} as const;

type ConsumerAccessRequestCreateInput =
  | {
      type: 'provider_template';
      providerTemplate: ProviderTemplate;
    }
  | {
      type: 'magic_mcp_server';
      magicMcpServer: MagicMcpServer;
    };

let getPendingConsumerAccessRequestKey = (d: {
  consumerProfileOid: bigint;
  accessRequest: ConsumerAccessRequestCreateInput;
}) => {
  if (d.accessRequest.type == 'provider_template') {
    return `consumer_profile:${d.consumerProfileOid.toString()}:provider_template:${d.accessRequest.providerTemplate.oid.toString()}`;
  }

  return `consumer_profile:${d.consumerProfileOid.toString()}:magic_mcp_server:${d.accessRequest.magicMcpServer.oid.toString()}`;
};

let isDuplicatePendingConsumerAccessRequestError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code == 'P2002';

class ConsumerAccessRequestServiceImpl {
  async listConsumerAccessRequests(d: {
    consumerSurface: ConsumerSurface;
    consumerProfileIds?: string[];
    providerTemplateIds?: string[];
    magicMcpServerIds?: string[];
    statuses?: ConsumerAccessRequestStatus[];
    search?: string;
  }) {
    let search = d.search?.trim();
    let hasConsumerProfileFilter = !!d.consumerProfileIds?.length;
    let hasProviderTemplateFilter = !!d.providerTemplateIds?.length;
    let hasMagicMcpServerFilter = !!d.magicMcpServerIds?.length;
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
    let [searchedConsumerAccessRequestIds, searchedConsumerIds] =
      search && instance
        ? await Promise.all([
            searchConsumerAccessRequestIds({
              instanceId: instance.id,
              query: search
            }),
            searchConsumerIds({
              instanceId: instance.id,
              query: search
            })
          ])
        : [undefined, undefined];
    let searchedConsumerProfileOids =
      search && searchedConsumerIds?.length
        ? (
            await db.consumerProfile.findMany({
              where: {
                surfaceOid: d.consumerSurface.oid,
                status: 'active',
                consumer: {
                  instanceConsumers: {
                    some: {
                      instanceOid: d.consumerSurface.instanceOid,
                      id: {
                        in: searchedConsumerIds
                      }
                    }
                  }
                }
              },
              select: {
                oid: true
              }
            })
          ).map(consumerProfile => consumerProfile.oid)
        : search
          ? []
          : undefined;

    let consumerProfiles = hasConsumerProfileFilter
      ? await db.consumerProfile.findMany({
          where: {
            surfaceOid: d.consumerSurface.oid,
            status: 'active',
            id: {
              in: d.consumerProfileIds
            }
          },
          select: {
            oid: true
          }
        })
      : undefined;
    let providerTemplates = hasProviderTemplateFilter
      ? await db.providerTemplate.findMany({
          where: {
            instanceOid: d.consumerSurface.instanceOid,
            id: {
              in: d.providerTemplateIds
            }
          },
          select: {
            oid: true
          }
        })
      : undefined;
    let magicMcpServers = hasMagicMcpServerFilter
      ? await db.magicMcpServer.findMany({
          where: {
            instanceOid: d.consumerSurface.instanceOid,
            id: {
              in: d.magicMcpServerIds
            }
          },
          select: {
            oid: true
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerAccessRequest.findMany({
          ...opts,
          where: {
            AND: [
              {
                surfaceOid: d.consumerSurface.oid,
                status: d.statuses?.length ? { in: d.statuses } : undefined,
                consumerProfileOid: hasConsumerProfileFilter
                  ? {
                      in: consumerProfiles?.map(profile => profile.oid) ?? []
                    }
                  : undefined,
                providerTemplateOid: hasProviderTemplateFilter
                  ? {
                      in:
                        providerTemplates?.map(providerTemplate => providerTemplate.oid) ?? []
                    }
                  : undefined,
                magicMcpServerOid: hasMagicMcpServerFilter
                  ? {
                      in: magicMcpServers?.map(magicMcpServer => magicMcpServer.oid) ?? []
                    }
                  : undefined
              },
              ...(search
                ? [
                    {
                      OR: [
                        {
                          id: {
                            in: searchedConsumerAccessRequestIds ?? []
                          }
                        },
                        {
                          consumerProfileOid: {
                            in: searchedConsumerProfileOids ?? []
                          }
                        }
                      ]
                    }
                  ]
                : [])
            ]
          },
          include
        });
      })
    );
  }

  async getConsumerAccessRequestById(d: {
    consumerSurface: ConsumerSurface;
    consumerAccessRequestId: string;
  }) {
    let consumerAccessRequest = await db.consumerAccessRequest.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        id: d.consumerAccessRequestId
      },
      include
    });
    if (!consumerAccessRequest) {
      throw new ServiceError(notFoundError('consumer.access_request'));
    }

    return consumerAccessRequest;
  }

  async createConsumerAccessRequest(d: {
    consumerProfile: ConsumerProfile & {
      personalConsumerGroup: ConsumerGroup;
    };
    accessRequest: ConsumerAccessRequestCreateInput;
    input?: {
      message?: string;
      metadata?: Record<string, unknown>;
    };
  }) {
    if (
      ('providerTemplate' in d.accessRequest &&
        d.accessRequest.providerTemplate.instanceOid != d.consumerProfile.instanceOid) ||
      ('magicMcpServer' in d.accessRequest &&
        d.accessRequest.magicMcpServer.instanceOid != d.consumerProfile.instanceOid)
    ) {
      throw new ServiceError(notFoundError('consumer.access_request.resource'));
    }

    if (
      'providerTemplate' in d.accessRequest &&
      d.accessRequest.providerTemplate.status != 'active'
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot request access to an inactive provider template.'
        })
      );
    }

    if (
      'magicMcpServer' in d.accessRequest &&
      d.accessRequest.magicMcpServer.status != 'active'
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot request access to an inactive magic MCP server.'
        })
      );
    }

    if (
      'magicMcpServer' in d.accessRequest &&
      !isPreconfiguredMagicMcpServer(d.accessRequest.magicMcpServer)
    ) {
      throw new ServiceError(notFoundError('consumer.access_request.resource'));
    }

    try {
      let consumerAccessRequest = await withTransaction(async db => {
        return await db.consumerAccessRequest.create({
          data: {
            id: await ID.generateId('consumerAccessRequest'),
            type: d.accessRequest.type,
            status: 'pending',
            message: d.input?.message,
            metadata: d.input?.metadata ?? {},
            pendingKey: getPendingConsumerAccessRequestKey({
              consumerProfileOid: d.consumerProfile.oid,
              accessRequest: d.accessRequest
            }),
            surfaceOid: d.consumerProfile.surfaceOid,
            consumerProfileOid: d.consumerProfile.oid,
            providerTemplateOid:
              d.accessRequest.type == 'provider_template'
                ? d.accessRequest.providerTemplate.oid
                : undefined,
            magicMcpServerOid:
              d.accessRequest.type == 'magic_mcp_server'
                ? d.accessRequest.magicMcpServer.oid
                : undefined
          },
          include
        });
      });

      await consumerAccessRequestCreatedQueue.add({
        consumerAccessRequestId: consumerAccessRequest.id
      });

      return consumerAccessRequest;
    } catch (error) {
      if (isDuplicatePendingConsumerAccessRequestError(error)) {
        throw new ServiceError(
          conflictError({
            message: 'A pending access request already exists for this item.'
          })
        );
      }

      throw error;
    }
  }

  async reviewConsumerAccessRequest(d: {
    organization: Organization;
    consumerAccessRequest: ConsumerAccessRequest & {
      surface: ConsumerSurface;
      consumerProfile: ConsumerProfile & {
        consumer: {
          id: string;
        };
        personalConsumerGroup: ConsumerGroup;
      };
      providerTemplate: ProviderTemplate | null;
      magicMcpServer: MagicMcpServer | null;
    };
    input: {
      status: 'approved' | 'rejected';
      resolutionMessage?: string;
      consumerGroup?: ConsumerGroup;
    };
  }) {
    if (d.consumerAccessRequest.status != 'pending') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Only pending access requests can be reviewed.'
        })
      );
    }

    let consumerAccessRequest = await withTransaction(async db => {
      return await db.consumerAccessRequest.update({
        where: {
          oid: d.consumerAccessRequest.oid
        },
        data: {
          status: d.input.status,
          resolutionMessage: d.input.resolutionMessage,
          pendingKey: null,
          reviewedAt: new Date()
        },
        include
      });
    });

    if (consumerAccessRequest.status == 'approved') {
      let consumerGroup =
        d.input.consumerGroup ?? consumerAccessRequest.consumerProfile.personalConsumerGroup;

      if (consumerGroup.surfaceOid != consumerAccessRequest.surface.oid) {
        throw new ServiceError(notFoundError('consumer.group'));
      }

      if (consumerGroup.status != 'active') {
        throw new ServiceError(
          preconditionFailedError({
            message: 'Cannot grant access to an inactive consumer group.'
          })
        );
      }
    }

    await consumerAccessRequestUpdatedQueue.add({
      consumerAccessRequestId: consumerAccessRequest.id,
      consumerGroupId: d.input.consumerGroup?.id
    });

    return consumerAccessRequest;
  }
}

export let consumerAccessRequestService = Service.create(
  'consumerAccessRequestService',
  () => new ConsumerAccessRequestServiceImpl()
).build();
