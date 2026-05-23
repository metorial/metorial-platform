import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Prisma } from '@metorial-cargo/db';
import { db, getId, withTransaction, type TransactionDB } from '@metorial-cargo/db';
import {
  normalizeDateFilter,
  resolveStoreVersions,
  type DateFilter
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { storeAccessService, storeReadPermission, type StoreAccessInput } from './storeAccess';

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
  kind: 'file' | 'document' | 'directory';
  path: string;
  fileId?: string;
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

let toCurrentStoreVersionItem = (
  item: CurrentStoreVersionItemRecord
): ResolvedStoreVersionItem => ({
  id: item.id,
  kind: item.kind,
  path: item.path,
  fileId: item.file?.id ?? undefined,
  documentId: item.document?.id ?? undefined,
  documentVersionId: item.document?.currentVersion?.id ?? undefined,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

let toSnapshotStoreVersionItem = (
  item: StoreVersionRecord['items'][number]
): ResolvedStoreVersionItem => ({
  id: item.id,
  kind: item.kind,
  path: item.path,
  fileId: item.file?.id ?? undefined,
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
  private async ensureSkillVersionForStoreVersion(
    tx: TransactionDB,
    d: {
      storeOid: bigint;
      storeVersionOid: bigint;
      versionNumber: number;
    }
  ) {
    let skill = await tx.skill.findUnique({
      where: {
        storeOid: d.storeOid
      },
      select: {
        oid: true
      }
    });

    if (!skill) return null;

    let ids = getId('skillVersion');

    return await tx.skillVersion.upsert({
      where: {
        storeVersionOid: d.storeVersionOid
      },
      create: {
        oid: ids.oid,
        id: ids.id,
        skillOid: skill.oid,
        storeVersionOid: d.storeVersionOid,
        versionNumber: d.versionNumber
      },
      update: {}
    });
  }

  async touchStoreLastEditedAt(d: { storeOid: bigint; at?: Date }) {
    return await withTransaction(
      async db => {
        let lastEditedAt = d.at ?? new Date();

        return await db.store.updateMany({
          where: {
            oid: d.storeOid
          },
          data: {
            lastEditedAt
          }
        });
      },
      { ifExists: true }
    );
  }

  async touchStoresLastEditedAtForDocument(d: { documentOid: bigint; at?: Date }) {
    return await withTransaction(
      async db => {
        let lastEditedAt = d.at ?? new Date();

        return await db.store.updateMany({
          where: {
            items: {
              some: {
                documentOid: d.documentOid
              }
            }
          },
          data: {
            lastEditedAt
          }
        });
      },
      { ifExists: true }
    );
  }

  async markStoreDirtyIfNeeded(d: { storeOid: bigint; at?: Date }) {
    return await withTransaction(
      async db => {
        let dirtyAt = d.at ?? new Date();

        return await db.store.updateMany({
          where: {
            oid: d.storeOid,
            dirtyAt: null
          },
          data: {
            dirtyAt
          }
        });
      },
      { ifExists: true }
    );
  }

  async markStoresDirtyForDocument(d: { documentOid: bigint; at?: Date }) {
    return await withTransaction(
      async db => {
        let dirtyAt = d.at ?? new Date();

        return await db.store.updateMany({
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
      },
      { ifExists: true }
    );
  }

  private async hasStoreLiveChangesSince(d: { storeOid: bigint; since: Date }) {
    return await withTransaction(
      async db => {
        let changedStoreItem = await db.storeItem.findFirst({
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
      },
      { ifExists: true }
    );
  }

  async createStoreVersionSnapshot(d: { storeId: string; expectedDirtyAt: Date }) {
    let snapshotStartedAt = new Date();

    return await withTransaction(async db => {
      let store = await db.store.findUnique({
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

      let existingVersion = await db.storeVersion.findFirst({
        where: {
          storeOid: store.oid,
          sourceDirtyAt: store.dirtyAt
        },
        include: storeVersionInclude
      });

      if (existingVersion) {
        await this.ensureSkillVersionForStoreVersion(db, {
          storeOid: existingVersion.store.oid,
          storeVersionOid: existingVersion.oid,
          versionNumber: existingVersion.versionNumber
        });

        return {
          version: toResolvedStoreVersion(existingVersion),
          didClearDirtyAt: false,
          alreadyExisted: true
        };
      }

      let currentItems = await db.storeItem.findMany({
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

      let latestVersion = await db.storeVersion.findFirst({
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
      let version = await db.storeVersion.create({
        data: {
          oid: versionIds.oid,
          id: versionIds.id,
          storeOid: store.oid,
          versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
          sourceDirtyAt: store.dirtyAt
        }
      });

      await this.ensureSkillVersionForStoreVersion(db, {
        storeOid: store.oid,
        storeVersionOid: version.oid,
        versionNumber: version.versionNumber
      });

      if (currentItems.length > 0) {
        await db.storeVersionItem.createMany({
          data: currentItems.map(item => {
            let itemIds = getId('storeVersionItem');

            return {
              oid: itemIds.oid,
              id: itemIds.id,
              storeVersionOid: version.oid,
              kind: item.kind,
              path: item.path,
              fileOid: item.fileOid ?? null,
              documentOid: item.documentOid,
              documentVersionOid: item.document?.currentVersion?.oid ?? null
            };
          })
        });
      }

      let shouldKeepDirty = await this.hasStoreLiveChangesSince({
        storeOid: store.oid,
        since: snapshotStartedAt
      });

      let didClearDirtyAt = false;

      if (!shouldKeepDirty) {
        let cleared = await db.store.updateMany({
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

      let createdVersion = await db.storeVersion.findUnique({
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
        ids?: string[];
        createdAt?: DateFilter;
        sourceDirtyAt?: DateFilter;
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

    let storeVersions = await resolveStoreVersions(d, d.ids);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.storeVersion.findMany({
            ...opts,
            where: {
              storeOid: store.oid,
              oid: storeVersions ? storeVersions.in : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
              sourceDirtyAt: d.sourceDirtyAt ? normalizeDateFilter(d.sourceDirtyAt) : undefined
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
