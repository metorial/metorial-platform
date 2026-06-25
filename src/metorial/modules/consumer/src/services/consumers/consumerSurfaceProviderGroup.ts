import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  ConsumerAccessListing,
  ConsumerSurface,
  ConsumerSurfaceProviderGroup,
  db,
  ID
} from '@metorial/db';

class ConsumerSurfaceProviderGroupServiceImpl {
  async create(d: {
    consumerSurface: ConsumerSurface;
    input: {
      name: string;
      description?: string;
    };
  }) {
    let maxIndex = await db.consumerSurfaceProviderGroup.aggregate({
      where: { consumerSurfaceOid: d.consumerSurface.oid },
      _max: { index: true }
    });

    let consumerSurfaceProviderGroup = await db.consumerSurfaceProviderGroup.create({
      data: {
        id: await ID.generateId('consumerSurfaceProviderGroup'),
        name: d.input.name,
        description: d.input.description,
        index: (maxIndex._max.index ?? -1) + 1,
        consumerSurfaceOid: d.consumerSurface.oid
      }
    });

    return consumerSurfaceProviderGroup;
  }

  async get(d: { consumerSurface: ConsumerSurface; consumerSurfaceProviderGroupId: string }) {
    let consumerSurfaceProviderGroup = await db.consumerSurfaceProviderGroup.findFirst({
      where: {
        consumerSurfaceOid: d.consumerSurface.oid,
        id: d.consumerSurfaceProviderGroupId
      }
    });

    if (!consumerSurfaceProviderGroup) {
      throw new ServiceError(notFoundError('consumer.surface_provider_group'));
    }

    return consumerSurfaceProviderGroup;
  }

  async list(d: { consumerSurface: ConsumerSurface }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerSurfaceProviderGroup.findMany({
          ...opts,
          where: {
            consumerSurfaceOid: d.consumerSurface.oid
          },
          orderBy: { index: 'asc' }
        });
      })
    );
  }

  async update(d: {
    consumerSurfaceProviderGroup: ConsumerSurfaceProviderGroup;
    input: {
      name?: string;
      description?: string;
      index?: number;
    };
  }) {
    let needsReorder =
      d.input.index !== undefined && d.input.index !== d.consumerSurfaceProviderGroup.index;

    if (needsReorder) {
      await this.reorder({
        consumerSurfaceProviderGroup: d.consumerSurfaceProviderGroup,
        newIndex: d.input.index!
      });
    }

    let consumerSurfaceProviderGroup = await db.consumerSurfaceProviderGroup.update({
      where: { oid: d.consumerSurfaceProviderGroup.oid },
      data: {
        ...(d.input.name !== undefined ? { name: d.input.name } : {}),
        ...(d.input.description !== undefined ? { description: d.input.description } : {})
      }
    });

    return consumerSurfaceProviderGroup;
  }

  async delete(d: { consumerSurfaceProviderGroup: ConsumerSurfaceProviderGroup }) {
    let oldIndex = d.consumerSurfaceProviderGroup.index;
    let surfaceOid = d.consumerSurfaceProviderGroup.consumerSurfaceOid;

    await db.$transaction(async tx => {
      await tx.consumerSurfaceProviderGroup.delete({
        where: { oid: d.consumerSurfaceProviderGroup.oid }
      });

      await tx.consumerSurfaceProviderGroup.updateMany({
        where: {
          consumerSurfaceOid: surfaceOid,
          index: { gt: oldIndex }
        },
        data: {
          index: { decrement: 1 }
        }
      });
    });
  }

  async addListing(d: {
    consumerSurfaceProviderGroup: ConsumerSurfaceProviderGroup;
    consumerAccessListing: ConsumerAccessListing;
  }) {
    if (
      d.consumerAccessListing.surfaceOid != d.consumerSurfaceProviderGroup.consumerSurfaceOid
    ) {
      throw new ServiceError(notFoundError('consumer.access_listing'));
    }

    await db.consumerSurfaceProviderGroupListing.upsert({
      where: {
        consumerSurfaceProviderGroupOid_consumerAccessListingOid: {
          consumerSurfaceProviderGroupOid: d.consumerSurfaceProviderGroup.oid,
          consumerAccessListingOid: d.consumerAccessListing.oid
        }
      },
      create: {
        consumerSurfaceProviderGroupOid: d.consumerSurfaceProviderGroup.oid,
        consumerAccessListingOid: d.consumerAccessListing.oid
      },
      update: {}
    });
  }

  async removeListing(d: {
    consumerSurfaceProviderGroup: ConsumerSurfaceProviderGroup;
    consumerAccessListing: ConsumerAccessListing;
  }) {
    if (
      d.consumerAccessListing.surfaceOid != d.consumerSurfaceProviderGroup.consumerSurfaceOid
    ) {
      throw new ServiceError(notFoundError('consumer.access_listing'));
    }

    await db.consumerSurfaceProviderGroupListing.deleteMany({
      where: {
        consumerSurfaceProviderGroupOid: d.consumerSurfaceProviderGroup.oid,
        consumerAccessListingOid: d.consumerAccessListing.oid
      }
    });
  }

  private async reorder(d: {
    consumerSurfaceProviderGroup: ConsumerSurfaceProviderGroup;
    newIndex: number;
  }) {
    let oldIndex = d.consumerSurfaceProviderGroup.index;
    let { newIndex } = d;

    if (oldIndex === newIndex) return;

    let surfaceOid = d.consumerSurfaceProviderGroup.consumerSurfaceOid;

    await db.$transaction(async tx => {
      if (newIndex < oldIndex) {
        await tx.consumerSurfaceProviderGroup.updateMany({
          where: {
            consumerSurfaceOid: surfaceOid,
            index: { gte: newIndex, lt: oldIndex }
          },
          data: {
            index: { increment: 1 }
          }
        });
      } else {
        await tx.consumerSurfaceProviderGroup.updateMany({
          where: {
            consumerSurfaceOid: surfaceOid,
            index: { gt: oldIndex, lte: newIndex }
          },
          data: {
            index: { decrement: 1 }
          }
        });
      }

      await tx.consumerSurfaceProviderGroup.update({
        where: { oid: d.consumerSurfaceProviderGroup.oid },
        data: { index: newIndex }
      });
    });
  }
}

export let consumerSurfaceProviderGroupService = Service.create(
  'consumerSurfaceProviderGroupService',
  () => new ConsumerSurfaceProviderGroupServiceImpl()
).build();
