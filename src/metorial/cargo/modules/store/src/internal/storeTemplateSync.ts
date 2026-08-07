import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import {
  documentInclude,
  documentService,
  internalDocumentDraftService,
  internalDocumentVersioningService
} from '@metorial/cargo-module-doc';
import {
  filePurposeService,
  fileService,
  getCargoFilesBucketName,
  getStorage
} from '@metorial/cargo-module-file';
import type { Prisma, Store, StoreItemKind, StoreTemplateItem } from '@metorial/db';
import { db, isUniqueConstraintError, withTransaction } from '@metorial/db';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import { storeItemInclude } from '../services/storeItem';
import { storeItemMutationService } from '../services/storeItemMutation';
import { storeVersionService } from '../services/storeVersion';

let syncTargetBatchSize = 100;

let storeTemplateSyncInclude = {
  resourceTenant: true,
  resourceGroup: true,
  items: {
    orderBy: [
      {
        path: 'asc'
      },
      {
        id: 'asc'
      }
    ]
  }
} satisfies Prisma.StoreTemplateInclude;

type StoreTemplateSyncRecord = Prisma.StoreTemplateGetPayload<{
  include: typeof storeTemplateSyncInclude;
}>;

type StoreTemplateSyncItem = StoreTemplateSyncRecord['items'][number];

let decodeStoreTemplateItemContent = (
  item: Pick<StoreTemplateItem, 'id' | 'kind' | 'content' | 'encoding'>
) => {
  if (item.kind === 'directory') return null;

  if (item.content === null || item.encoding === null) {
    throw new ServiceError(
      badRequestError({
        message: `Store template item ${item.id} is missing content`
      })
    );
  }

  return item.encoding === 'base64'
    ? Buffer.from(item.content, 'base64')
    : Buffer.from(item.content, 'utf8');
};

let getStoreTemplateItemName = (path: string) => {
  let normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
  let name = normalizedPath.split('/').filter(Boolean).at(-1);

  return name || 'template-item';
};

let getDocumentTitle = (item: StoreTemplateSyncItem, content: string) => {
  if (item.title) return item.title;

  let firstLine = content.match(/^[^\r\n]*/)?.[0] ?? '';
  if (firstLine.startsWith('#')) {
    let title = firstLine.replace(/^#+\s*/, '').trim();
    if (title) return title;
  }

  return getStoreTemplateItemName(item.path);
};

let sortStoreItemsForRemoval = <T extends { path: string; kind: StoreItemKind }>(items: T[]) =>
  [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? 1 : -1;
    return b.path.length - a.path.length;
  });

class InternalStoreTemplateSyncServiceImpl {
  private async getTemplate(d: { storeTemplateId: string }) {
    let storeTemplate = await db.storeTemplate.findFirst({
      where: {
        id: d.storeTemplateId
      },
      include: storeTemplateSyncInclude
    });

    if (!storeTemplate) {
      throw new ServiceError(notFoundError('storeTemplate', d.storeTemplateId));
    }

    return storeTemplate;
  }

  private assertStandaloneTemplate(
    storeTemplate: Pick<StoreTemplateSyncRecord, 'id' | 'type'>
  ) {
    if (storeTemplate.type !== 'standalone') {
      throw new ServiceError(
        badRequestError({
          message: `Store template ${storeTemplate.id} is not a standalone template`
        })
      );
    }
  }

  private async createTemplateItemHash(d: { item: StoreTemplateItem }) {
    let content = decodeStoreTemplateItemContent(d.item);
    let contentHash = content ? await Hash.sha256(content.toString('base64')) : null;
    let fileStoreId =
      content && d.item.kind === 'file'
        ? `template_${contentHash}`
        : content
          ? `template_doc_${contentHash}`
          : null;
    let contentByteSize = content?.length ?? null;
    let hash = await Hash.sha256(
      canonicalize({
        kind: d.item.kind,
        path: d.item.path,
        encoding: d.item.encoding,
        contentHash,
        mimeType: d.item.mimeType,
        title: d.item.title
      })
    );

    return {
      hash,
      contentHash,
      fileStoreId,
      contentByteSize,
      content
    };
  }

  async refreshStoreTemplateItemHash(d: { storeTemplateItemId: string }) {
    let item = await db.storeTemplateItem.findFirst({
      where: {
        id: d.storeTemplateItemId
      },
      include: {
        storeTemplate: {
          select: {
            id: true
          }
        }
      }
    });

    if (!item) return null;

    let next = await this.createTemplateItemHash({
      item
    });

    if (item.kind === 'file' && next.content && next.fileStoreId) {
      await getStorage().putObject(
        getCargoFilesBucketName(),
        next.fileStoreId,
        new Blob([next.content]),
        item.mimeType ?? 'application/octet-stream'
      );
    }

    let changed =
      item.hash !== next.hash ||
      item.contentHash !== next.contentHash ||
      item.fileStoreId !== next.fileStoreId ||
      item.contentByteSize !== next.contentByteSize;

    if (changed) {
      await db.storeTemplateItem.update({
        where: {
          id: item.id
        },
        data: {
          hash: next.hash,
          contentHash: next.contentHash,
          fileStoreId: next.fileStoreId,
          contentByteSize: next.contentByteSize
        }
      });
    }

    return {
      storeTemplateId: item.storeTemplate.id,
      storeTemplateOid: item.storeTemplateOid,
      itemId: item.id,
      changed
    };
  }

  async refreshStoreTemplateHash(d: {
    storeTemplateId: string;
    updatedItemIds?: string[];
    forceFullReconcile?: boolean;
  }) {
    let storeTemplate = await this.getTemplate(d);
    this.assertStandaloneTemplate(storeTemplate);

    let itemsMissingHashes = storeTemplate.items.filter(item => !item.hash);
    if (itemsMissingHashes.length > 0) {
      return {
        storeTemplate,
        changed: false,
        shouldSync: false,
        missingItemIds: itemsMissingHashes.map(item => item.id)
      };
    }

    let hash = await Hash.sha256(
      canonicalize(
        storeTemplate.items
          .map(item => ({
            path: item.path,
            hash: item.hash
          }))
          .sort((a, b) => a.path.localeCompare(b.path))
      )
    );
    let changed = storeTemplate.hash !== hash;

    if (changed) {
      storeTemplate = await db.storeTemplate.update({
        where: {
          id: storeTemplate.id
        },
        data: {
          hash
        },
        include: storeTemplateSyncInclude
      });
    }

    return {
      storeTemplate,
      changed,
      shouldSync: changed || !!d.forceFullReconcile,
      missingItemIds: []
    };
  }

  async listStoreTemplateSyncTargets(d: {
    storeTemplateId: string;
    cursor?: string;
    limit?: number;
  }) {
    let storeTemplate = await this.getTemplate(d);
    this.assertStandaloneTemplate(storeTemplate);

    let limit = d.limit ?? syncTargetBatchSize;

    if (storeTemplate.resourceGroupOid) {
      if (d.cursor) {
        return {
          targets: [],
          nextCursor: undefined
        };
      }

      return {
        targets: [
          {
            resourceTenant: storeTemplate.resourceTenant!,
            resourceGroup: storeTemplate.resourceGroup!
          }
        ],
        nextCursor: undefined
      };
    }

    let environments = await db.resourceGroup.findMany({
      where: {
        resourceTenantOid: storeTemplate.resourceTenantOid ?? undefined,
        id: d.cursor
          ? {
              gt: d.cursor
            }
          : undefined
      },
      include: {
        resourceTenant: true
      },
      orderBy: {
        id: 'asc'
      },
      take: limit
    });

    return {
      targets: environments.map(resourceGroup => ({
        resourceTenant: resourceGroup.resourceTenant,
        resourceGroup
      })),
      nextCursor:
        environments.length === limit ? environments[environments.length - 1]!.id : undefined
    };
  }

  private async ensureBackingStore(
    d: ResourceScope & {
      storeTemplate: StoreTemplateSyncRecord;
    }
  ) {
    try {
      return await withTransaction(async db => {
        let existing = await db.storeTemplateBacking.findFirst({
          where: {
            storeTemplateOid: d.storeTemplate.oid,
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid
          },
          include: {
            store: true
          }
        });

        if (existing) {
          let store = existing.store;
          if (
            store.name !== d.storeTemplate.name ||
            store.access !== 'public_read' ||
            !store.isReadOnly ||
            !store.isTemplateBacking ||
            store.parentStoreTemplateOid !== d.storeTemplate.oid
          ) {
            store = await db.store.update({
              where: {
                id: store.id
              },
              data: {
                name: d.storeTemplate.name,
                access: 'public_read',
                isReadOnly: true,
                isTemplateBacking: true,
                parentStoreTemplateOid: d.storeTemplate.oid
              }
            });
          }

          return {
            backing: existing,
            store
          };
        }

        let storeIds = getId('store');
        let backingIds = getId('storeTemplateBacking');
        let store = await db.store.create({
          data: {
            oid: storeIds.oid,
            id: storeIds.id,
            name: d.storeTemplate.name,
            access: 'public_read',
            itemCount: 0,
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid,
            parentStoreTemplateOid: d.storeTemplate.oid,
            isReadOnly: true,
            isTemplateBacking: true
          }
        });

        let backing = await db.storeTemplateBacking.upsert({
          where: {
            storeTemplateOid_resourceTenantOid_resourceGroupOid: {
              storeTemplateOid: d.storeTemplate.oid,
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid
            }
          },
          create: {
            oid: backingIds.oid,
            id: backingIds.id,
            storeTemplateOid: d.storeTemplate.oid,
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid,
            storeOid: store.oid
          },
          update: {},
          include: {
            store: true
          }
        });

        if (backing.storeOid !== store.oid) {
          await db.store.delete({
            where: {
              id: store.id
            }
          });

          store = backing.store;
        }

        return {
          backing,
          store
        };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let backing = await db.storeTemplateBacking.findUnique({
        where: {
          storeTemplateOid_resourceTenantOid_resourceGroupOid: {
            storeTemplateOid: d.storeTemplate.oid,
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid
          }
        },
        include: {
          store: true
        }
      });
      if (!backing) throw error;

      return {
        backing,
        store: backing.store
      };
    }
  }

  private async removeItems(
    d: ResourceScope & {
      store: Store;
      items: Array<{ id: string; path: string; kind: StoreItemKind }>;
    }
  ) {
    for (let item of sortStoreItemsForRemoval(d.items)) {
      let currentItem = await db.storeItem.findFirst({
        where: {
          storeOid: d.store.oid,
          id: item.id
        },
        select: {
          id: true
        }
      });
      if (!currentItem) continue;

      await storeItemMutationService.modifyStoreItems({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        store: d.store,
        operations: [
          {
            type: 'remove',
            itemId: item.id
          }
        ],
        allowReadOnly: true
      });
    }
  }

  private async upsertFileItem(
    d: ResourceScope & {
      store: Store;
      item: StoreTemplateSyncItem;
      existingItem?: Prisma.StoreItemGetPayload<{ include: typeof storeItemInclude }>;
    }
  ) {
    let filePurpose = await filePurposeService.ensureGenericFilePurpose();
    let name = getStoreTemplateItemName(d.item.path);
    let mimeType = d.item.mimeType ?? 'application/octet-stream';
    let size = d.item.contentByteSize ?? decodeStoreTemplateItemContent(d.item)?.length ?? 0;
    let file =
      d.existingItem?.kind === 'file' && d.existingItem.file
        ? await db.file.update({
            where: {
              id: d.existingItem.file.id
            },
            data: {
              storeId: d.item.fileStoreId!,
              fileName: name,
              fileSize: size,
              fileType: mimeType,
              title: name,
              status: 'active',
              purposeOid: filePurpose.oid,
              isReadOnly: true,
              isTemplateBacking: true
            },
            include: {
              purpose: true,
              document: {
                select: {
                  id: true
                }
              },
              resourceTenant: true,
              resourceGroup: true
            }
          })
        : await fileService.createFile({
            resourceTenant: d.resourceTenant,
            resourceGroup: d.resourceGroup,
            purpose: filePurpose.id,
            storeId: d.item.fileStoreId!,
            input: {
              name,
              mimeType,
              size,
              title: name,
              authorization: { type: 'privileged' }
            },
            internal: {
              isReadOnly: true,
              isTemplateBacking: true
            }
          });

    await storeItemMutationService.attachTargetToStore({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      store: d.store,
      path: d.item.path,
      target: {
        file,
        document: null
      },
      allowReadOnly: true
    });
  }

  private async upsertDocumentItem(
    d: ResourceScope & {
      store: Store;
      item: StoreTemplateSyncItem;
      existingItem?: Prisma.StoreItemGetPayload<{ include: typeof storeItemInclude }>;
    }
  ) {
    let content = decodeStoreTemplateItemContent(d.item)!.toString('utf8');
    let title = getDocumentTitle(d.item, content);

    if (d.existingItem?.kind === 'document' && d.existingItem.document) {
      let document = await internalDocumentDraftService.withDocumentLock(
        d.existingItem.document.id,
        async () =>
          await withTransaction(async db => {
            let currentDocument = await db.document.findFirst({
              where: {
                id: d.existingItem!.document!.id
              },
              include: documentInclude
            });
            if (!currentDocument)
              throw new ServiceError(notFoundError('document', d.existingItem!.document!.id));

            let hasContentChange = currentDocument.content.content !== content;
            let hasTitleChange = currentDocument.title !== title;

            if (!hasContentChange && !hasTitleChange) return currentDocument;

            let contentIds = hasContentChange ? getId('documentContent') : null;
            if (contentIds) {
              await db.documentContent.create({
                data: {
                  oid: contentIds.oid,
                  content
                }
              });
            }

            let version = contentIds
              ? await internalDocumentVersioningService.createVersion({
                  resourceTenant: d.resourceTenant,
                  resourceGroup: d.resourceGroup,
                  document: currentDocument,
                  contentOid: contentIds.oid,
                  previousVersionOid: currentDocument.currentVersionOid,
                  listEditedAt: new Date()
                })
              : null;

            await db.file.update({
              where: {
                id: currentDocument.file.id
              },
              data: {
                storeId: d.item.fileStoreId!,
                fileName: title,
                fileSize: d.item.contentByteSize ?? Buffer.byteLength(content, 'utf8'),
                fileType: 'text/markdown',
                title,
                isReadOnly: true,
                isTemplateBacking: true
              }
            });

            return await db.document.update({
              where: {
                id: currentDocument.id
              },
              data: {
                title,
                isReadOnly: true,
                isTemplateBacking: true,
                contentOid: contentIds ? contentIds.oid : undefined,
                currentVersionOid: contentIds ? version!.oid : undefined,
                isContentOwner: contentIds ? true : undefined
              },
              include: documentInclude
            });
          })
      );

      await storeItemMutationService.attachTargetToStore({
        resourceTenant: d.resourceTenant,
        resourceGroup: d.resourceGroup,
        store: d.store,
        path: d.item.path,
        target: {
          file: document.file,
          document: {
            oid: document.oid,
            id: document.id
          }
        },
        allowReadOnly: true
      });

      return;
    }

    let document = await documentService.createDocument({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      input: {
        title,
        content,
        fileStoreId: d.item.fileStoreId,
        authorization: { type: 'privileged' }
      },
      internal: {
        isReadOnly: true,
        isTemplateBacking: true
      }
    });

    await storeItemMutationService.attachTargetToStore({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      store: d.store,
      path: d.item.path,
      target: {
        file: document.file,
        document: {
          oid: document.oid,
          id: document.id
        }
      },
      allowReadOnly: true
    });
  }

  async syncStoreTemplateBackingStore(d: {
    storeTemplateId: string;
    resourceTenantId: string;
    resourceGroupId: string;
    updatedItemIds?: string[];
    forceFullReconcile?: boolean;
  }) {
    let storeTemplate = await this.getTemplate(d);
    this.assertStandaloneTemplate(storeTemplate);

    if (!storeTemplate.hash) return null;

    let resourceTenant = await db.resourceTenant.findFirst({
      where: {
        id: d.resourceTenantId
      }
    });
    if (!resourceTenant)
      throw new ServiceError(notFoundError('resourceTenant', d.resourceTenantId));

    let resourceGroup = await db.resourceGroup.findFirst({
      where: {
        id: d.resourceGroupId,
        resourceTenantOid: resourceTenant.oid
      }
    });
    if (!resourceGroup)
      throw new ServiceError(notFoundError('resourceGroup', d.resourceGroupId));

    if (
      storeTemplate.resourceTenantOid &&
      storeTemplate.resourceTenantOid !== resourceTenant.oid
    )
      return null;
    if (storeTemplate.resourceGroupOid && storeTemplate.resourceGroupOid !== resourceGroup.oid)
      return null;

    let { backing, store } = await this.ensureBackingStore({
      storeTemplate,
      resourceTenant,
      resourceGroup
    });

    if (backing.lastSyncedHash === storeTemplate.hash && !d.forceFullReconcile) {
      return {
        store,
        changed: false
      };
    }

    let currentItems = await db.storeItem.findMany({
      where: {
        storeOid: store.oid
      },
      include: storeItemInclude
    });
    let itemByPath = new Map(currentItems.map(item => [item.path, item]));
    let templateItemByPath = new Map(storeTemplate.items.map(item => [item.path, item]));
    let templatePaths = storeTemplate.items.map(item => item.path);

    await this.removeItems({
      resourceTenant,
      resourceGroup,
      store,
      items: currentItems
        .filter(item => {
          let templateItem = templateItemByPath.get(item.path);
          if (templateItem) return templateItem.kind !== item.kind;
          if (item.kind === 'directory') {
            return !templatePaths.some(path => path.startsWith(item.path));
          }

          return true;
        })
        .filter(item => item.path !== '/')
    });

    for (let item of storeTemplate.items) {
      if (item.kind !== 'directory' && (!item.hash || !item.fileStoreId)) continue;

      if (item.kind === 'directory') {
        if (item.path === '/') continue;

        await storeItemMutationService.modifyStoreItems({
          resourceTenant,
          resourceGroup,
          store,
          operations: [
            {
              type: 'add',
              path: item.path
            }
          ],
          allowReadOnly: true
        });
        continue;
      }

      let existingItem = itemByPath.get(item.path);
      if (item.kind === 'file') {
        await this.upsertFileItem({
          resourceTenant,
          resourceGroup,
          store,
          item,
          existingItem
        });
        continue;
      }

      await this.upsertDocumentItem({
        resourceTenant,
        resourceGroup,
        store,
        item,
        existingItem
      });
    }

    let desiredPaths = new Set(storeTemplate.items.map(item => item.path));
    let desiredPathList = [...desiredPaths];
    let latestItems = await db.storeItem.findMany({
      where: {
        storeOid: store.oid
      },
      select: {
        id: true,
        path: true,
        kind: true
      }
    });

    await this.removeItems({
      resourceTenant,
      resourceGroup,
      store,
      items: latestItems.filter(item => {
        if (item.path === '/' || desiredPaths.has(item.path)) return false;
        if (item.kind === 'directory') {
          return !desiredPathList.some(path => path.startsWith(item.path));
        }

        return true;
      })
    });

    await db.storeTemplateBacking.update({
      where: {
        id: backing.id
      },
      data: {
        lastSyncedHash: storeTemplate.hash
      }
    });

    await storeVersionService.touchStoreLastEditedAt({
      storeOid: store.oid
    });

    return {
      store,
      changed: true
    };
  }
}

export let internalStoreTemplateSyncService = Service.create(
  'cargoInternalStoreTemplateSyncService',
  () => new InternalStoreTemplateSyncServiceImpl()
).build();
