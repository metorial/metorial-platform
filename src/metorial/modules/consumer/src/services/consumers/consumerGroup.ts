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
import { Fabric } from '@metorial/fabric';
import { searchConsumerGroupIds } from '@metorial/module-search';
import {
  consumerGroupArchivedQueue,
  consumerGroupCreatedQueue,
  consumerGroupUpdatedQueue
} from '../../queues/lifecycle/consumerGroup';

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
    let consumerGroup = await withTransaction(async tx => {
      await Fabric.fire('consumer.group.created:before', {
        consumerSurface: d.consumerSurface,
        input: d.input
      });

      let accessTag = await tx.accessTag.create({
        data: {
          instanceOid: d.consumerSurface.instanceOid
        }
      });

      let consumerGroup = await tx.consumerGroup.create({
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

      await Fabric.fire('consumer.group.created:after', {
        consumerSurface: d.consumerSurface,
        consumerGroup,
        input: d.input
      });

      return consumerGroup;
    });

    await consumerGroupCreatedQueue.add({ consumerGroupId: consumerGroup.id });

    return consumerGroup;
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
    search?: string;
  }) {
    let search = d.search?.trim();
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
    let searchedConsumerGroupIds =
      search && instance
        ? await searchConsumerGroupIds({
            instanceId: instance.id,
            query: search
          })
        : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerGroup.findMany({
          ...opts,
          where: {
            AND: [
              {
                surfaceOid: d.consumerSurface.oid,
                type: 'default',
                status: d.status?.length ? { in: d.status } : 'active'
              },
              ...(search ? [{ id: { in: searchedConsumerGroupIds ?? [] } }] : [])
            ]
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

    let consumerGroup = await withTransaction(async tx => {
      await Fabric.fire('consumer.group.updated:before', {
        consumerGroup: d.consumerGroup,
        input: d.input
      });

      let consumerGroup = await tx.consumerGroup.update({
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

      await Fabric.fire('consumer.group.updated:after', {
        consumerGroup,
        input: d.input
      });

      return consumerGroup;
    });

    await consumerGroupUpdatedQueue.add({ consumerGroupId: consumerGroup.id });

    return consumerGroup;
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

    let consumerGroup = await withTransaction(async tx => {
      await Fabric.fire('consumer.group.archived:before', {
        organization: d.organization,
        consumerGroup: d.consumerGroup
      });

      let consumerGroup = await tx.consumerGroup.update({
        where: {
          oid: d.consumerGroup.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date(),
          deletedAt: null
        }
      });

      await Fabric.fire('consumer.group.archived:after', {
        organization: d.organization,
        consumerGroup
      });

      return consumerGroup;
    });

    await consumerGroupArchivedQueue.add({ consumerGroupId: consumerGroup.id });

    return consumerGroup;
  }
}

export let consumerGroupService = Service.create(
  'consumerGroupService',
  () => new ConsumerGroupServiceImpl()
).build();
