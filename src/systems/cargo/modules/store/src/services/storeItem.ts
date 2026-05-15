import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, StoreItemKind, StoreParticipantPermissions } from '@metorial-cargo/db';
import { db } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocuments,
  resolveFileReferences,
  resolveFiles,
  resolveStoreDirectories,
  resolveStoreItems,
  resolveStores,
  resolveTenantActors
} from '@metorial-cargo/list-utils';
import { internalDocumentContentStoreService } from '@metorial-cargo/module-doc';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { storeAccessService, storeReadPermission } from './storeAccess';

export let storeItemInclude = {
  store: {
    select: {
      id: true
    }
  },
  directory: {
    select: {
      id: true,
      path: true,
      isAutoCreated: true
    }
  },
  parentDirectory: {
    select: {
      id: true,
      path: true,
      isAutoCreated: true
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
  private async withEffectiveDocumentStore<T extends StoreItemRecord>(item: T) {
    if (!item.document) {
      return item as T;
    }

    let effectiveStoreSource =
      await internalDocumentContentStoreService.getEffectiveDocumentStoreSource(item.document);
    if (effectiveStoreSource.file.storeId === item.document.file.storeId) {
      return item as T;
    }

    return {
      ...item,
      document: {
        ...item.document,
        file: {
          ...item.document.file,
          effectiveStoreId: effectiveStoreSource.file.storeId
        }
      }
    };
  }

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

    return await this.withEffectiveDocumentStore(item);
  }

  async listStoreItems(
    d: CargoTenantEnvironment & {
      ids?: string[];
      storeId?: string;
      storeIds?: string[];
      fileId?: string;
      fileIds?: string[];
      documentId?: string;
      documentIds?: string[];
      referenceIds?: string[];
      directoryIds?: string[];
      parentDirectoryIds?: string[];
      lastModifiedByActorIds?: string[];
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
      types?: StoreItemKind[];
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let types = d.types ?? ['file', 'document'];
    let items = await resolveStoreItems(d, d.ids);
    let stores = await resolveStores(d, d.storeIds);
    let files = await resolveFiles(d, d.fileIds ?? (d.fileId ? [d.fileId] : undefined));
    let documents = await resolveDocuments(
      d,
      d.documentIds ?? (d.documentId ? [d.documentId] : undefined)
    );
    let references = await resolveFileReferences(d, d.referenceIds);
    let directories = await resolveStoreDirectories(d, d.directoryIds);
    let parentDirectories = await resolveStoreDirectories(d, d.parentDirectoryIds);
    let lastModifiedByActors = await resolveTenantActors(d, d.lastModifiedByActorIds);

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
          await Promise.all(
            (
              await db.storeItem.findMany({
                ...opts,
                where: {
                  oid: items ? items.in : undefined,
                  store: {
                    tenantOid: d.tenant.oid,
                    environmentOid: d.environment.oid,
                    isTemplateBacking: d.storeId ? undefined : false,
                    oid: accessibleStoreOids
                      ? {
                          in: accessibleStoreOids
                        }
                      : stores
                        ? stores.in
                        : undefined,
                    id: d.storeId ? d.storeId : undefined,
                    AND: stores && accessibleStoreOids ? [{ oid: stores.in }] : undefined
                  },
                  fileOid: files ? files.in : undefined,
                  documentOid: documents ? documents.in : undefined,
                  referenceOid: references ? references.in : undefined,
                  directoryOid: directories ? directories.in : undefined,
                  parentDirectoryOid: parentDirectories ? parentDirectories.in : undefined,
                  lastModifiedByTenantActorOid: lastModifiedByActors
                    ? lastModifiedByActors.in
                    : undefined,
                  AND: [
                    d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                    d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
                  ].filter(Boolean),
                  kind: {
                    in: types
                  }
                },
                include: storeItemInclude
              })
            ).map(async item => await this.withEffectiveDocumentStore(item))
          )
      )
    );
  }
}

export let storeItemService = Service.create(
  'cargoStoreItemService',
  () => new StoreItemServiceImpl()
).build();
