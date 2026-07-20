import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocuments,
  resolveFileReferences,
  resolveFiles,
  resolveResourceActors,
  resolveStoreDirectories,
  resolveStoreItems
} from '@metorial/cargo-list-utils';
import { internalDocumentContentStoreService } from '@metorial/cargo-module-doc';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import type { Prisma, StoreItemKind, StoreParticipantPermissions } from '@metorial/db';
import { db } from '@metorial/db';
import { storeAccessService, storeReadPermission } from './storeAccess';
import type { StoreAccessInput } from './storeAccess';

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
    d: ResourceScope &
      StoreAccessInput & {
      itemId: string;
      }
  ) {
    let item = await db.storeItem.findFirst({
      where: {
        store: {
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid
        },
        id: d.itemId
      },
      include: storeItemInclude
    });

    if (!item) throw new ServiceError(notFoundError('storeItem', d.itemId));

    await storeAccessService.assertStoreAccessForStoreItem({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      item,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return await this.withEffectiveDocumentStore(item);
  }

  async listStoreItems(
    d: ResourceScope &
      StoreAccessInput & {
      ids?: string[];
      storeId: string;
      fileIds?: string[];
      documentIds?: string[];
      referenceIds?: string[];
      directoryIds?: string[];
      parentDirectoryIds?: string[];
      lastModifiedByActorIds?: string[];
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
      types?: StoreItemKind[];
      }
  ) {
    let types = d.types ?? ['file', 'document'];
    let items = await resolveStoreItems(d, d.ids);
    let files = await resolveFiles(d, d.fileIds);
    let documents = await resolveDocuments(d, d.documentIds);
    let references = await resolveFileReferences(d, d.referenceIds);
    let directories = await resolveStoreDirectories(d, d.directoryIds);
    let parentDirectories = await resolveStoreDirectories(d, d.parentDirectoryIds);
    let lastModifiedByActors = await resolveResourceActors(d, d.lastModifiedByActorIds);

    let accessibleStoreOids = d.authorization.type === 'restricted'
      ? (
          await storeAccessService.resolveAccessibleStoreOids({
            resourceTenant: d.resourceTenant,
            resourceGroup: d.resourceGroup,
            authorization: d.authorization,
            defaultPermissions: d.defaultPermissions,
            overridePermissions: d.overridePermissions,
            requiredPermission: storeReadPermission,
            storeOids: [
              (
                await storeAccessService.getStoreById({
                  resourceTenant: d.resourceTenant,
                  resourceGroup: d.resourceGroup,
                  storeId: d.storeId
                })
              ).oid
            ]
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
                    resourceTenantOid: d.resourceTenant.oid,
                    resourceGroupOid: d.resourceGroup.oid,
                    isTemplateBacking: d.storeId ? undefined : false,
                    oid: accessibleStoreOids ? { in: accessibleStoreOids } : undefined,
                    id: d.storeId
                  },
                  fileOid: files ? files.in : undefined,
                  documentOid: documents ? documents.in : undefined,
                  referenceOid: references ? references.in : undefined,
                  directoryOid: directories ? directories.in : undefined,
                  parentDirectoryOid: parentDirectories ? parentDirectories.in : undefined,
                  lastModifiedByResourceActorOid: lastModifiedByActors
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
