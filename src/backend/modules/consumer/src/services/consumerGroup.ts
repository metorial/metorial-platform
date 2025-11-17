import { ConsumerGroup, ConsumerSurface, db, ID, withTransaction } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { Service } from '@metorial/service';
import { Paginator } from '../../../../../packages/server/pagination/src';

let include = {};

class consumerGroupServiceImpl {
  async createConsumerGroup(d: {
    input: {
      name: string;
      description?: string;
      ssoGroupIds?: string[];
      isDefault?: boolean;
    };
    consumerSurface: ConsumerSurface;
  }) {
    return await db.consumerGroup.create({
      data: {
        id: await ID.generateId('consumerGroup'),
        status: 'active',
        name: d.input.name,
        description: d.input.description,
        surfaceOid: d.consumerSurface.oid,
        ssoGroupIds: d.input.ssoGroupIds || [],
        isDefault: !!d.input.isDefault
      },
      include
    });
  }

  async updateConsumerGroup(d: {
    consumerGroup: ConsumerGroup;
    input: {
      name?: string;
      description?: string;
      groupIds?: string[];
      isDefault?: boolean;
    };
  }) {
    return withTransaction(async db => {
      return await db.consumerGroup.update({
        where: { oid: d.consumerGroup.oid },
        data: {
          name: d.input.name ?? d.consumerGroup.name,
          description: d.input.description ?? d.consumerGroup.description,
          ssoGroupIds: d.input.groupIds ?? d.consumerGroup.ssoGroupIds,
          isDefault: d.input.isDefault ?? d.consumerGroup.isDefault
        },
        include
      });
    });
  }

  async getConsumerGroupById(d: {
    consumerSurface: ConsumerSurface;
    consumerGroupId: string;
  }) {
    let consumerGroup = await db.consumerGroup.findFirst({
      where: { id: d.consumerGroupId, surfaceOid: d.consumerSurface.oid },
      include
    });
    if (!consumerGroup) throw new ServiceError(notFoundError('consumer.group'));
    return consumerGroup;
  }

  async listConsumerGroups(d: {
    consumerSurface: ConsumerSurface;
    consumerProfileIds?: string[];
  }) {
    let consumerProfiles = d.consumerProfileIds
      ? await db.consumerProfile.findMany({
          where: {
            id: { in: d.consumerProfileIds },
            surfaceOid: d.consumerSurface.oid
          },
          include: {
            groups: true
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.consumerGroup.findMany({
            ...opts,
            where: {
              surfaceOid: d.consumerSurface.oid,
              status: 'active',

              ...(consumerProfiles
                ? {
                    oid: { in: consumerProfiles.flatMap(cp => cp.groups.map(g => g.groupOid)) }
                  }
                : {})
            },
            include
          })
      )
    );
  }

  async deleteConsumerGroup(d: { consumerGroup: ConsumerGroup }) {
    if (d.consumerGroup.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Consumer group is already inactive.'
        })
      );
    }

    return withTransaction(async db => {
      return await db.consumerGroup.update({
        where: { oid: d.consumerGroup.oid },
        data: { status: 'inactive' },
        include
      });
    });
  }
}

export let consumerGroupService = Service.create(
  'consumerGroupService',
  () => new consumerGroupServiceImpl()
).build();
