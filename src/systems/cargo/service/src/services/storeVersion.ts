import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, PrismaClient } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import type { CargoTenantEnvironment } from './filePurpose';
import {
  storeAccessService,
  storeReadPermission,
  type StoreAccessInput
} from './storeAccess';

type DbClient = PrismaClient | Prisma.TransactionClient;

let currentStoreVersionItemInclude = {
  file: {
    select: {
      id: true
    }
  },
  document: {
    select: {
      id: true,
      currentVersion: {
        select: {
          oid: true,
          id: true
        }
      }
    }
  }
} satisfies Prisma.StoreItemInclude;

let storeVersionInclude = {
  store: {
    select: {
      oid: true,
      id: true,
      name: true,
      dirtyAt: true,
      createdAt: true,
      updatedAt: true
    }
  },
  items: {
    include: {
      file: {
        select: {
          id: true
        }
      },
      document: {
        select: {
          id: true
        }
      },
      documentVersion: {
        select: {
          id: true
        }
      }
    },
    orderBy: [
      {
        path: 'asc'
      },
      {
        id: 'asc'
      }
    ]
  }
} satisfies Prisma.StoreVersionInclude;

type CurrentStoreVersionItemRecord = Prisma.StoreItemGetPayload<{
  include: typeof currentStoreVersionItemInclude;
}>;

type StoreVersionRecord = Prisma.StoreVersionGetPayload<{
  include: typeof storeVersionInclude;
}>;

export type ResolvedStoreVersionItem = {
  id: string;
  path: string;
  fileId: string;
  documentId?: string;
  documentVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ResolvedStoreVersion = {
  id: string;
  kind: 'latest' | 'snapshot';
  storeId: string;
  storeName: string;
  versionNumber: number | null;
  sourceDirtyAt: Date | null;
  dirtyAt: Date | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
  items: ResolvedStoreVersionItem[];
};

export type ResolvedStoreVersionSummary = Omit<ResolvedStoreVersion, 'items'>;

let toCurrentStoreVersionItem = (item: CurrentStoreVersionItemRecord): ResolvedStoreVersionItem => ({
  id: item.id,
  path: item.path,
  fileId: item.file.id,
  documentId: item.document?.id ?? undefined,
  documentVersionId: item.document?.currentVersion?.id ?? undefined,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

let toSnapshotStoreVersionItem = (
  item: StoreVersionRecord['items'][number]
): ResolvedStoreVersionItem => ({
  id: item.id,
  path: item.path,
  fileId: item.file.id,
  documentId: item.document?.id ?? undefined,
  documentVersionId: item.documentVersion?.id ?? undefined,
  createdAt: item.createdAt,
  updatedAt: item.createdAt
});

let toStoreVersionSummary = (version: StoreVersionRecord): ResolvedStoreVersionSummary => ({
  id: version.id,
  kind: 'snapshot',
  storeId: version.store.id,
  storeName: version.store.name,
  versionNumber: version.versionNumber,
  sourceDirtyAt: version.sourceDirtyAt,
  dirtyAt: version.store.dirtyAt,
  itemCount: version.items.length,
  createdAt: version.createdAt,
  updatedAt: version.createdAt
});

let toResolvedStoreVersion = (version: StoreVersionRecord): ResolvedStoreVersion => ({
  ...toStoreVersionSummary(version),
  items: version.items.map(toSnapshotStoreVersionItem)
});

class StoreVersionServiceImpl {
  async markStoreDirtyIfNeeded(d: {
    storeOid: bigint;
    at?: Date;
    client?: DbClient;
  }) {
    let client = d.client ?? db;
    let dirtyAt = d.at ?? new Date();

    return await client.store.updateMany({
      where: {
        oid: d.storeOid,
        dirtyAt: null
      },
      data: {
        dirtyAt
      }
    });
  }

  async markStoresDirtyForDocument(d: {
    documentOid: bigint;
    at?: Date;
    client?: DbClient;
  }) {
    let client = d.client ?? db;
    let dirtyAt = d.at ?? new Date();

    return await client.store.updateMany({
      where: {
        dirtyAt: null,
        items: {
          some: {
            documentOid: d.documentOid
          }
        }
      },
      data: {
        dirtyAt
      }
    });
  }

  async listStoreIdsReadyForVersioning(d: {
    limit: number;
    dirtyBefore: Date;
    cursorOid?: string;
  }) {
    let cursorOid = d.cursorOid ? BigInt(d.cursorOid) : undefined;
    let stores = await db.store.findMany({
      where: {
        dirtyAt: {
          not: null,
          lte: d.dirtyBefore
        },
        ...(cursorOid
          ? {
              oid: {
                gt: cursorOid
              }
            }
          : {})
      },
      orderBy: {
        oid: 'asc'
      },
      take: d.limit,
      select: {
        oid: true,
        id: true,
        dirtyAt: true
      }
    });

    return {
      stores: stores.map(store => ({
        storeId: store.id,
        dirtyAt: store.dirtyAt!
      })),
      nextCursorOid:
        stores.length === d.limit ? stores[stores.length - 1]!.oid.toString() : undefined
    };
  }

  private async hasStoreLiveChangesSince(
    client: DbClient,
    d: {
      storeOid: bigint;
      since: Date;
    }
  ) {
    let changedStoreItem = await client.storeItem.findFirst({
      where: {
        storeOid: d.storeOid,
        OR: [
          {
            createdAt: {
              gt: d.since
            }
          },
          {
            updatedAt: {
              gt: d.since
            }
          },
          {
            document: {
              currentVersion: {
                createdAt: {
                  gt: d.since
                }
              }
            }
          }
        ]
      },
      select: {
        id: true
      }
    });

    return !!changedStoreItem;
  }

  async createStoreVersionSnapshot(d: {
    storeId: string;
    expectedDirtyAt: Date;
  }) {
    let snapshotStartedAt = new Date();

    return await db.$transaction(async tx => {
      let store = await tx.store.findUnique({
        where: {
          id: d.storeId
        },
        select: {
          oid: true,
          id: true,
          name: true,
          itemCount: true,
          dirtyAt: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!store?.dirtyAt) return null;
      if (store.dirtyAt.getTime() !== d.expectedDirtyAt.getTime()) return null;

      let existingVersion = await tx.storeVersion.findFirst({
        where: {
          storeOid: store.oid,
          sourceDirtyAt: store.dirtyAt
        },
        include: storeVersionInclude
      });

      if (existingVersion) {
        return {
          version: toResolvedStoreVersion(existingVersion),
          didClearDirtyAt: false,
          alreadyExisted: true
        };
      }

      let currentItems = await tx.storeItem.findMany({
        where: {
          storeOid: store.oid
        },
        include: currentStoreVersionItemInclude,
        orderBy: [
          {
            path: 'asc'
          },
          {
            id: 'asc'
          }
        ]
      });

      let latestVersion = await tx.storeVersion.findFirst({
        where: {
          storeOid: store.oid
        },
        orderBy: {
          versionNumber: 'desc'
        },
        select: {
          versionNumber: true
        }
      });

      let versionIds = getId('storeVersion');
      let version = await tx.storeVersion.create({
        data: {
          oid: versionIds.oid,
          id: versionIds.id,
          storeOid: store.oid,
          versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
          sourceDirtyAt: store.dirtyAt
        }
      });

      if (currentItems.length > 0) {
        await tx.storeVersionItem.createMany({
          data: currentItems.map(item => {
            let itemIds = getId('storeVersionItem');

            return {
              oid: itemIds.oid,
              id: itemIds.id,
              storeVersionOid: version.oid,
              path: item.path,
              fileOid: item.fileOid,
              documentOid: item.documentOid,
              documentVersionOid: item.document?.currentVersion?.oid ?? null
            };
          })
        });
      }

      let shouldKeepDirty = await this.hasStoreLiveChangesSince(tx, {
        storeOid: store.oid,
        since: snapshotStartedAt
      });

      let didClearDirtyAt = false;

      if (!shouldKeepDirty) {
        let cleared = await tx.store.updateMany({
          where: {
            oid: store.oid,
            dirtyAt: d.expectedDirtyAt
          },
          data: {
            dirtyAt: null
          }
        });

        didClearDirtyAt = cleared.count > 0;
      }

      let createdVersion = await tx.storeVersion.findUnique({
        where: {
          id: version.id
        },
        include: storeVersionInclude
      });

      return {
        version: toResolvedStoreVersion(createdVersion!),
        didClearDirtyAt,
        alreadyExisted: false
      };
    });
  }

  async listStoreVersions(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        storeId: string;
      }
  ) {
    let store = await storeAccessService.getStoreById({
      tenant: d.tenant,
      environment: d.environment,
      storeId: d.storeId
    });

    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        await db.storeVersion.findMany({
          ...opts,
          where: {
            storeOid: store.oid
          },
          include: storeVersionInclude,
          orderBy: {
            versionNumber: 'desc'
          }
        })
      )
    );
  }

  async getStoreVersionById(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        storeVersionId: string;
      }
  ) {
    let version = await db.storeVersion.findFirst({
      where: {
        id: d.storeVersionId,
        store: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        }
      },
      include: storeVersionInclude
    });

    if (!version) throw new ServiceError(notFoundError('storeVersion', d.storeVersionId));

    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: version.store,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return toResolvedStoreVersion(version);
  }

  async getLatestStoreVersion(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        storeId: string;
      }
  ) {
    let store = await storeAccessService.getStoreById({
      tenant: d.tenant,
      environment: d.environment,
      storeId: d.storeId
    });

    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    let items = await db.storeItem.findMany({
      where: {
        storeOid: store.oid
      },
      include: currentStoreVersionItemInclude,
      orderBy: [
        {
          path: 'asc'
        },
        {
          id: 'asc'
        }
      ]
    });

    return {
      id: 'latest',
      kind: 'latest',
      storeId: store.id,
      storeName: store.name,
      versionNumber: null,
      sourceDirtyAt: null,
      dirtyAt: store.dirtyAt,
      itemCount: items.length,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
      items: items.map(toCurrentStoreVersionItem)
    } satisfies ResolvedStoreVersion;
  }

  async getResolvedStoreVersion(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        storeId: string;
        storeVersionId: string;
      }
  ) {
    if (d.storeVersionId === 'latest') {
      return await this.getLatestStoreVersion(d);
    }

    let version = await this.getStoreVersionById({
      tenant: d.tenant,
      environment: d.environment,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      storeVersionId: d.storeVersionId
    });

    if (version.storeId !== d.storeId) {
      throw new ServiceError(notFoundError('storeVersion', d.storeVersionId));
    }

    return version;
  }
}

export let storeVersionService = Service.create(
  'cargoStoreVersionService',
  () => new StoreVersionServiceImpl()
).build();
