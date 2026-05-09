import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, StoreParticipantPermissions } from '../../prisma/generated/client';
import { db } from '../db';
import type { CargoTenantEnvironment } from './filePurpose';
import { storeAccessService, storeReadPermission } from './storeAccess';

export let storeItemInclude = {
  store: {
    select: {
      id: true
    }
  },
  file: {
    include: {
      purpose: true,
      document: {
        select: {
          id: true
        }
      }
    }
  },
  document: {
    include: {
      parentDocument: true,
      content: true,
      currentVersion: true,
      file: {
        include: {
          purpose: true
        }
      }
    }
  },
  reference: true
} satisfies Prisma.StoreItemInclude;

export type StoreItemRecord = Prisma.StoreItemGetPayload<{
  include: typeof storeItemInclude;
}>;

class StoreItemServiceImpl {
  async getStoreItemById(
    d: CargoTenantEnvironment & {
      itemId: string;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let item = await db.storeItem.findFirst({
      where: {
        store: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        id: d.itemId
      },
      include: storeItemInclude
    });

    if (!item) throw new ServiceError(notFoundError('storeItem', d.itemId));

    await storeAccessService.assertStoreAccessForStoreItem({
      tenant: d.tenant,
      environment: d.environment,
      item,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return item;
  }

  async listStoreItems(
    d: CargoTenantEnvironment & {
      storeId?: string;
      fileId?: string;
      documentId?: string;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let accessibleStoreOids = d.actorId
      ? d.storeId
        ? (
            await storeAccessService.resolveAccessibleStoreOids({
              tenant: d.tenant,
              environment: d.environment,
              actorId: d.actorId,
              defaultPermissions: d.defaultPermissions,
              overridePermissions: d.overridePermissions,
              requiredPermission: storeReadPermission,
              storeOids: [
                (
                  await storeAccessService.getStoreById({
                    tenant: d.tenant,
                    environment: d.environment,
                    storeId: d.storeId
                  })
                ).oid
              ]
            })
          ).accessibleStoreOids
        : (
            await storeAccessService.listAccessibleStoreOidsForTenantEnvironment({
              tenant: d.tenant,
              environment: d.environment,
              actorId: d.actorId,
              defaultPermissions: d.defaultPermissions,
              overridePermissions: d.overridePermissions,
              requiredPermission: storeReadPermission
            })
          ).accessibleStoreOids
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.storeItem.findMany({
            ...opts,
            where: {
              store: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
                oid: accessibleStoreOids
                  ? {
                      in: accessibleStoreOids
                    }
                  : undefined,
                ...(d.storeId
                  ? {
                      id: d.storeId
                    }
                  : {})
              },
              file: d.fileId
                ? {
                    id: d.fileId
                  }
                : undefined,
              document: d.documentId
                ? {
                    id: d.documentId
                  }
                : undefined
            },
            include: storeItemInclude
          })
      )
    );
  }
}

export let storeItemService = Service.create(
  'cargoStoreItemService',
  () => new StoreItemServiceImpl()
).build();
