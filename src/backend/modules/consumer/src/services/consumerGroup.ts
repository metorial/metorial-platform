import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  ConsumerGroup,
  ConsumerSurface,
  db,
  ID,
  Organization,
  withTransaction
} from '@metorial/db';
import { consumerAccessPolicyService } from './accessPolicy';

class ConsumerGroupServiceImpl {
  async createConsumerGroup(d: {
    consumerSurface: ConsumerSurface;
    input: {
      name: string;
      description?: string;
      ssoGroupIds?: string[];
      isDefault?: boolean;
    };
  }) {
    return await withTransaction(async tx => {
      let accessTag = await tx.accessTag.create({
        data: {
          instanceOid: d.consumerSurface.instanceOid
        }
      });

      return await tx.consumerGroup.create({
        data: {
          id: await ID.generateId('consumerGroup'),
          status: 'active',
          type: 'default',
          isDefault: !!d.input.isDefault,
          ssoGroupIds: d.input.ssoGroupIds ?? [],
          name: d.input.name,
          description: d.input.description,
          surfaceOid: d.consumerSurface.oid,
          accessTagOid: accessTag.oid
        }
      });
    });
  }

  async getConsumerGroupById(d: {
    consumerSurface: ConsumerSurface;
    consumerGroupId: string;
    types?: ConsumerGroup['type'][];
  }) {
    let consumerGroup = await db.consumerGroup.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        id: d.consumerGroupId,
        type: d.types?.length ? { in: d.types } : 'default'
      }
    });
    if (!consumerGroup) {
      throw new ServiceError(notFoundError('consumer.group'));
    }

    return consumerGroup;
  }

  async listConsumerGroups(d: {
    consumerSurface: ConsumerSurface;
    status?: ConsumerGroup['status'][];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerGroup.findMany({
          ...opts,
          where: {
            surfaceOid: d.consumerSurface.oid,
            type: 'default',
            status: d.status?.length ? { in: d.status } : 'active'
          }
        });
      })
    );
  }

  async updateConsumerGroup(d: {
    consumerGroup: ConsumerGroup;
    input: {
      name?: string;
      description?: string;
      ssoGroupIds?: string[];
      isDefault?: boolean;
    };
  }) {
    if (d.consumerGroup.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a non-active consumer group.'
        })
      );
    }

    if (d.consumerGroup.type != 'default') {
      throw new ServiceError(notFoundError('consumer.group'));
    }

    return await db.consumerGroup.update({
      where: {
        oid: d.consumerGroup.oid
      },
      data: {
        name: d.input.name,
        description: d.input.description,
        ssoGroupIds: d.input.ssoGroupIds,
        isDefault: d.input.isDefault
      }
    });
  }

  async deleteConsumerGroup(d: { organization: Organization; consumerGroup: ConsumerGroup }) {
    if (d.consumerGroup.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Consumer group is already archived or deleted.'
        })
      );
    }

    if (d.consumerGroup.type != 'default') {
      throw new ServiceError(notFoundError('consumer.group'));
    }

    return await withTransaction(async tx => {
      let consumerAccesses = await tx.consumerAccess.findMany({
        where: {
          consumerGroupOid: d.consumerGroup.oid
        },
        include: {
          consumerGroup: true,
          providerTemplate: true,
          magicMcpServer: true
        }
      });

      for (let consumerAccess of consumerAccesses) {
        await consumerAccessPolicyService.revokeAccessForConsumerAccess({
          organization: d.organization,
          consumerAccess
        });
      }

      await tx.consumerAccess.deleteMany({
        where: {
          consumerGroupOid: d.consumerGroup.oid
        }
      });

      return await tx.consumerGroup.update({
        where: {
          oid: d.consumerGroup.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date(),
          deletedAt: null
        }
      });
    });
  }
}

export let consumerGroupService = Service.create(
  'consumerGroupService',
  () => new ConsumerGroupServiceImpl()
).build();
