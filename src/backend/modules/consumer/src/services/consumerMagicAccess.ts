import {
  ConsumerSurface,
  ConsumerSurfaceMagicMcpGroupAccess,
  db,
  ID,
  MagicMcpGroup
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Paginator } from '../../../../../packages/server/pagination/src';

let include = {
  magicMcpGroup: true
};

class consumerSurfaceMagicMcpAccessServiceImpl {
  async listConsumerSurfaceMagicMcpAccesses(d: { consumerSurface: ConsumerSurface }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.consumerSurfaceMagicMcpGroupAccess.findMany({
            ...opts,
            where: {
              surfaceOid: d.consumerSurface.oid
            },
            include
          })
      )
    );
  }

  async getConsumerSurfaceMagicMcpAccessById(d: {
    consumerSurface: ConsumerSurface;
    groupId: string;
  }) {
    let consumerSurface = await db.consumerSurfaceMagicMcpGroupAccess.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        OR: [{ id: d.groupId }, { magicMcpGroup: { id: d.groupId } }]
      },
      include
    });
    if (!consumerSurface)
      throw new ServiceError(notFoundError('consumer.surface.magic_mcp_access'));
    return consumerSurface;
  }

  async createConsumerSurfaceMagicMcpAccess(d: {
    consumerSurface: ConsumerSurface;
    magicMcpGroup: MagicMcpGroup;
  }) {
    return await db.consumerSurfaceMagicMcpGroupAccess.create({
      data: {
        id: await ID.generateId('consumerSurfaceMagicMcpGroupAccess'),
        surfaceOid: d.consumerSurface.oid,
        magicMcpGroupOid: d.magicMcpGroup.oid
      },
      include
    });
  }

  async deleteConsumerSurfaceMagicMcpAccess(d: {
    groupAccess: ConsumerSurfaceMagicMcpGroupAccess;
  }) {
    return await db.consumerSurfaceMagicMcpGroupAccess.delete({
      where: {
        oid: d.groupAccess.oid
      },
      include
    });
  }
}

export let consumerSurfaceMagicMcpAccessService = Service.create(
  'consumerSurfaceMagicMcpAccessService',
  () => new consumerSurfaceMagicMcpAccessServiceImpl()
).build();
