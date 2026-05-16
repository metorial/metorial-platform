import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  Skill,
  Store,
  StoreDirectory,
  StoreItemKind,
  TenantActor
} from '@metorial-cargo/db';
import { db, getId, withTransaction } from '@metorial-cargo/db';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { fileLinkService, fileReferenceService } from '@metorial-cargo/module-file';
import {
  listAncestorDirectoryPaths,
  normalizeStorePath,
  type NormalizedStorePath
} from '../lib/storePath';
import { enqueueStoreLifecycle } from '../queues/lifecycle';
import { storeItemInclude, type StoreItemRecord } from './storeItem';
import { storeVersionService } from './storeVersion';

export type StoreItemOperationInput = {
  type?: 'add' | 'modify' | 'remove';
  itemId?: string;
  fileId?: string;
  documentId?: string;
  path?: string;
};

export type StoreItemMutationResult =
  | {
      type: 'add' | 'modify';
      item: StoreItemRecord;
    }
  | {
      type: 'remove';
      item: StoreItemRecord;
    };

type ResolvedStoreItemFile = {
  oid: bigint;
  id: string;
  status: 'active' | 'deleted';
  purpose: {
    canHaveLinks: boolean;
  };
};

export type ResolvedStoreItemTarget = {
  file: ResolvedStoreItemFile;
  document: {
    oid: bigint;
    id: string;
  } | null;
};

type NormalizedStoreItemOperation =
  | {
      type: 'add';
      path: NormalizedStorePath;
      kind: StoreItemKind;
      target?: ResolvedStoreItemTarget;
    }
  | {
      type: 'modify';
      itemId: string;
      path?: string;
      target?: ResolvedStoreItemTarget;
    }
  | {
      type: 'remove';
      itemId: string;
    };

let modifyOperationLimit = 500;
let maxStoreItems = 1000;
let reservedSkillDocumentName = 'SKILL.md';
let agentsDirectoryPath = '/agents/';

type SkillStoreRecord = Pick<Skill, 'oid' | 'id'>;

class StoreItemMutationServiceImpl {
  private assertStoreWritable(d: {
    store: Pick<Store, 'id'> & { isReadOnly?: boolean };
    allowReadOnly?: boolean;
  }) {
    if (!d.allowReadOnly && d.store.isReadOnly) {
      throw new ServiceError(
        badRequestError({
          message: `Store ${d.store.id} is read-only`
        })
      );
    }
  }

  private getContentItemKind(target: ResolvedStoreItemTarget): StoreItemKind {
    return target.document ? 'document' : 'file';
  }

  private async getSkillForStore(store: Pick<Store, 'oid'>) {
    return await withTransaction(
      async db =>
        await db.skill.findFirst({
          where: {
            storeOid: store.oid
          },
          select: {
            oid: true,
            id: true
          }
        }),
      { ifExists: true }
    );
  }

  private getAgentSlug(path: NormalizedStorePath) {
    return path.name!.replace(/\.md$/i, '');
  }

  private isAgentPath(path: NormalizedStorePath) {
    return path.parentPath === agentsDirectoryPath && path.name?.toLowerCase().endsWith('.md');
  }

  private getAgentNameFromItem(
    item: StoreItemRecord,
    path: NormalizedStorePath,
    preferPathName?: boolean
  ) {
    let slug = this.getAgentSlug(path);
    if (preferPathName) return slug;

    return item.document?.title?.trim() || slug;
  }

  private assertSkillStoreItemAllowed(d: { path: NormalizedStorePath; kind: StoreItemKind }) {
    if (d.path.name === reservedSkillDocumentName && d.kind !== 'document') {
      throw new ServiceError(
        badRequestError({
          message: 'SKILL.md is reserved for documents in skill stores'
        })
      );
    }

    if (d.path.parentPath === agentsDirectoryPath) {
      if (d.kind !== 'document' || !d.path.name?.toLowerCase().endsWith('.md')) {
        throw new ServiceError(
          badRequestError({
            message: 'Only markdown documents can be added to the agents directory of a skill'
          })
        );
      }
    }
  }

  private assertSkillStoreRemoveAllowed(item: StoreItemRecord) {
    let path = this.normalizeExistingItemPath(item);

    if (path.path === `/${reservedSkillDocumentName}`) {
      throw new ServiceError(
        badRequestError({
          message: 'SKILL.md cannot be removed from a skill store'
        })
      );
    }
  }

  private assertSkillStoreModifyAllowed(d: {
    item: StoreItemRecord;
    nextPath: NormalizedStorePath;
    nextKind: StoreItemKind;
  }) {
    let currentPath = this.normalizeExistingItemPath(d.item);

    if (
      currentPath.path === `/${reservedSkillDocumentName}` &&
      d.nextPath.path !== currentPath.path
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'SKILL.md cannot be moved in a skill store'
        })
      );
    }

    this.assertSkillStoreItemAllowed({
      path: d.nextPath,
      kind: d.nextKind
    });
  }

  private async archiveActiveSkillAgentsForStoreItem(d: {
    skill: SkillStoreRecord;
    item: Pick<StoreItemRecord, 'oid'>;
  }) {
    await withTransaction(
      async db => {
        await db.skillAgent.updateMany({
          where: {
            skillOid: d.skill.oid,
            storeItemOid: d.item.oid,
            status: 'active'
          },
          data: {
            status: 'archived',
            storeItemOid: null,
            archivedAt: new Date()
          }
        });
      },
      { ifExists: true }
    );
  }

  private async upsertSkillAgentForStoreItem(d: {
    skill: SkillStoreRecord;
    item: StoreItemRecord;
    path: NormalizedStorePath;
    preferPathName?: boolean;
  }) {
    if (d.item.kind !== 'document' || !d.item.documentOid || !d.item.document) return;

    await withTransaction(
      async db => {
        let slug = this.getAgentSlug(d.path);
        let name = this.getAgentNameFromItem(d.item, d.path, d.preferPathName);
        let documentOid = d.item.documentOid!;
        let existingActive = await db.skillAgent.findFirst({
          where: {
            skillOid: d.skill.oid,
            storeItemOid: d.item.oid,
            status: 'active'
          }
        });

        if (existingActive) {
          await db.skillAgent.update({
            where: {
              id: existingActive.id
            },
            data: {
              name,
              slug,
              documentOid
            }
          });
          return;
        }

        let archivedAgent = await db.skillAgent.findFirst({
          where: {
            skillOid: d.skill.oid,
            documentOid,
            status: 'archived'
          },
          orderBy: {
            updatedAt: 'desc'
          }
        });

        if (archivedAgent) {
          await db.skillAgent.update({
            where: {
              id: archivedAgent.id
            },
            data: {
              name,
              slug,
              status: 'active',
              storeItemOid: d.item.oid,
              archivedAt: null
            }
          });
          return;
        }

        let ids = getId('skillAgent');
        await db.skillAgent.create({
          data: {
            ...ids,
            name,
            slug,
            skillOid: d.skill.oid,
            storeItemOid: d.item.oid,
            documentOid
          }
        });
      },
      { ifExists: true }
    );
  }

  private async syncSkillAgentForStoreItemTransition(d: {
    skill: SkillStoreRecord | null;
    previousItem?: StoreItemRecord | null;
    nextItem?: StoreItemRecord | null;
  }) {
    if (!d.skill) return;

    let previousPath = d.previousItem ? this.normalizeExistingItemPath(d.previousItem) : null;
    let nextPath = d.nextItem ? this.normalizeExistingItemPath(d.nextItem) : null;
    let wasAgent =
      !!previousPath && this.isAgentPath(previousPath) && d.previousItem?.kind === 'document';
    let isAgent = !!nextPath && this.isAgentPath(nextPath) && d.nextItem?.kind === 'document';

    if (wasAgent && !isAgent) {
      await this.archiveActiveSkillAgentsForStoreItem({
        skill: d.skill,
        item: d.previousItem!
      });
      return;
    }

    if (!isAgent) return;

    await this.upsertSkillAgentForStoreItem({
      skill: d.skill,
      item: d.nextItem!,
      path: nextPath!,
      preferPathName: !!previousPath && previousPath.path !== nextPath!.path
    });
  }

  private normalizeExistingItemPath(item: Pick<StoreItemRecord, 'path' | 'kind'>) {
    return normalizeStorePath({
      path: item.path,
      kind: item.kind === 'directory' ? 'directory' : 'file'
    });
  }

  private validateContentItem(item: StoreItemRecord) {
    if (item.kind === 'directory' || !item.file) {
      throw new ServiceError(
        badRequestError({
          message: `Store item ${item.id} is not a file or document item`
        })
      );
    }
  }

  private async getStoreItemRecord(d: { store: Pick<Store, 'oid'>; itemId: string }) {
    return await withTransaction(
      async client => {
        let item = await client.storeItem.findFirst({
          where: {
            storeOid: d.store.oid,
            id: d.itemId
          },
          include: storeItemInclude
        });

        if (!item) throw new ServiceError(notFoundError('storeItem', d.itemId));

        return item;
      },
      { ifExists: true }
    );
  }

  private async getStoreItemByPath(d: { store: Pick<Store, 'oid'>; path: string }) {
    return await withTransaction(
      async client =>
        await client.storeItem.findFirst({
          where: {
            storeOid: d.store.oid,
            path: d.path
          },
          include: storeItemInclude
        }),
      { ifExists: true }
    );
  }

  private async getStoreDirectoryByPath(d: { store: Pick<Store, 'oid'>; path: string }) {
    return await withTransaction(
      async client =>
        await client.storeDirectory.findFirst({
          where: {
            storeOid: d.store.oid,
            path: d.path
          }
        }),
      { ifExists: true }
    );
  }

  private ensureOnlyOneTarget(fileId?: string, documentId?: string) {
    if (fileId && documentId) {
      throw new ServiceError(
        badRequestError({
          message: 'Provide either fileId or documentId, not both'
        })
      );
    }
  }

  private async resolveStoreItemTarget(
    d: CargoTenantEnvironment & {
      fileId?: string;
      documentId?: string;
      allowEmpty?: boolean;
    }
  ) {
    this.ensureOnlyOneTarget(d.fileId, d.documentId);

    if (!d.fileId && !d.documentId) {
      if (d.allowEmpty) return undefined;

      throw new ServiceError(
        badRequestError({
          message: 'Provide either fileId or documentId'
        })
      );
    }

    if (d.documentId) {
      let document = await db.document.findFirst({
        where: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          id: d.documentId,
          file: {
            status: 'active'
          }
        },
        include: {
          file: {
            include: {
              purpose: true
            }
          }
        }
      });

      if (!document) throw new ServiceError(notFoundError('document', d.documentId));

      return {
        file: document.file,
        document: {
          oid: document.oid,
          id: document.id
        }
      } satisfies ResolvedStoreItemTarget;
    }

    let file = await db.file.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.fileId,
        status: 'active'
      },
      include: {
        purpose: true,
        document: {
          select: {
            oid: true,
            id: true
          }
        }
      }
    });

    if (!file) throw new ServiceError(notFoundError('file', d.fileId!));

    return {
      file,
      document: file.document
    } satisfies ResolvedStoreItemTarget;
  }

  private async normalizeStoreItemOperation(
    d: CargoTenantEnvironment & {
      operation: StoreItemOperationInput;
    }
  ): Promise<NormalizedStoreItemOperation> {
    let { operation } = d;
    let type =
      operation.type ??
      (operation.itemId
        ? operation.path || operation.fileId || operation.documentId
          ? 'modify'
          : 'remove'
        : 'add');

    if (type === 'add') {
      let target = await this.resolveStoreItemTarget({
        tenant: d.tenant,
        environment: d.environment,
        fileId: operation.fileId,
        documentId: operation.documentId,
        allowEmpty: true
      });
      let kind = target ? this.getContentItemKind(target) : 'directory';

      return {
        type: 'add',
        kind,
        path: normalizeStorePath({
          path: operation.path,
          kind: kind === 'directory' ? 'directory' : 'file'
        }),
        target: target ?? undefined
      };
    }

    if (!operation.itemId) {
      throw new ServiceError(
        badRequestError({
          message: 'Store item itemId is required'
        })
      );
    }

    if (type === 'remove') {
      if (operation.path || operation.fileId || operation.documentId) {
        throw new ServiceError(
          badRequestError({
            message: 'Remove operations only accept itemId'
          })
        );
      }

      return {
        type: 'remove',
        itemId: operation.itemId
      };
    }

    return {
      type: 'modify',
      itemId: operation.itemId,
      path: operation.path,
      target: await this.resolveStoreItemTarget({
        tenant: d.tenant,
        environment: d.environment,
        fileId: operation.fileId,
        documentId: operation.documentId,
        allowEmpty: true
      })
    };
  }

  private async createItemReference(
    d: CargoTenantEnvironment & {
      itemId: string;
      target: ResolvedStoreItemTarget;
    }
  ) {
    return await withTransaction(async () => {
      let link = await fileLinkService.createFileLink({
        tenant: d.tenant,
        environment: d.environment,
        file: d.target.file,
        input: {}
      });

      return await fileReferenceService.upsertFileReference({
        tenant: d.tenant,
        environment: d.environment,
        fileLink: link,
        input: {
          entityType: 'store_item',
          entityId: d.itemId
        }
      });
    });
  }

  private async ensureDirectoryRecord(d: {
    store: Pick<Store, 'oid'>;
    path: string;
    isAutoCreated: boolean;
  }) {
    return await withTransaction(async client => {
      let normalizedPath = normalizeStorePath({
        path: d.path,
        kind: 'directory'
      });
      let existingDirectory = await this.getStoreDirectoryByPath({
        store: d.store,
        path: normalizedPath.path
      });

      if (existingDirectory) {
        if (!d.isAutoCreated && existingDirectory.isAutoCreated) {
          return await client.storeDirectory.update({
            where: {
              id: existingDirectory.id
            },
            data: {
              isAutoCreated: false
            }
          });
        }

        return existingDirectory;
      }

      let parentDirectory =
        normalizedPath.parentPath === null
          ? null
          : await this.getStoreDirectoryByPath({
              store: d.store,
              path: normalizedPath.parentPath
            });

      let directoryIds = getId('storeDirectory');
      return await client.storeDirectory.upsert({
        where: {
          storeOid_path: {
            storeOid: d.store.oid,
            path: normalizedPath.path
          }
        },
        create: {
          oid: directoryIds.oid,
          id: directoryIds.id,
          storeOid: d.store.oid,
          path: normalizedPath.path,
          isAutoCreated: d.isAutoCreated,
          parentDirectoryOid: parentDirectory?.oid ?? null
        },
        update: {
          isAutoCreated: d.isAutoCreated ? undefined : false,
          parentDirectoryOid: parentDirectory?.oid ?? null
        }
      });
    });
  }

  private async ensureDirectoryItem(
    d: CargoTenantEnvironment & {
      store: Store;
      directory: StoreDirectory;
      actor?: Pick<TenantActor, 'oid'>;
    }
  ) {
    return await withTransaction(async client => {
      let existingItem = await this.getStoreItemByPath({
        store: d.store,
        path: d.directory.path
      });

      if (existingItem) {
        if (existingItem.kind !== 'directory') {
          throw new ServiceError(
            badRequestError({
              message: `Store item path already exists: ${d.directory.path}`
            })
          );
        }

        if (
          existingItem.directoryOid === d.directory.oid &&
          existingItem.parentDirectoryOid === (d.directory.parentDirectoryOid ?? null)
        ) {
          return {
            item: existingItem,
            created: false
          };
        }

        return {
          created: false,
          item: await client.storeItem.update({
            where: {
              id: existingItem.id
            },
            data: {
              directoryOid: d.directory.oid,
              parentDirectoryOid: d.directory.parentDirectoryOid ?? null,
              lastModifiedByTenantActorOid: d.actor ? d.actor.oid : undefined
            },
            include: storeItemInclude
          })
        };
      }

      let itemIds = getId('storeItem');
      return {
        created: true,
        item: await client.storeItem.create({
          data: {
            oid: itemIds.oid,
            id: itemIds.id,
            kind: 'directory',
            path: d.directory.path,
            storeOid: d.store.oid,
            directoryOid: d.directory.oid,
            parentDirectoryOid: d.directory.parentDirectoryOid ?? null,
            lastModifiedByTenantActorOid: d.actor ? d.actor.oid : undefined
          },
          include: storeItemInclude
        })
      };
    });
  }

  private async ensureDirectoryHierarchy(
    d: CargoTenantEnvironment & {
      store: Store;
      path: NormalizedStorePath;
      actor?: Pick<TenantActor, 'oid'>;
      includeSelf?: boolean;
      explicitSelf?: boolean;
    }
  ) {
    return await withTransaction(async () => {
      let createdItemCount = 0;
      let ensuredItem: StoreItemRecord | null = null;
      let directoryPaths = listAncestorDirectoryPaths(d.path, {
        includeSelf: d.includeSelf
      });

      for (let directoryPath of directoryPaths) {
        let directory = await this.ensureDirectoryRecord({
          store: d.store,
          path: directoryPath,
          isAutoCreated: !(d.explicitSelf && directoryPath === d.path.path)
        });
        let ensured = await this.ensureDirectoryItem({
          tenant: d.tenant,
          environment: d.environment,
          store: d.store,
          directory,
          actor: d.actor
        });

        if (ensured.created) {
          createdItemCount += 1;
        }
        if (directoryPath === d.path.path) {
          ensuredItem = ensured.item;
        }
      }

      return {
        createdItemCount,
        item: ensuredItem
      };
    });
  }

  private async pruneImplicitDirectories(d: {
    store: Store;
    startPath: string | null | undefined;
  }) {
    return await withTransaction(async client => {
      let removedItemCount = 0;
      let currentPath = d.startPath;

      while (currentPath && currentPath !== '/') {
        let directory = await this.getStoreDirectoryByPath({
          store: d.store,
          path: currentPath
        });
        if (!directory || !directory.isAutoCreated) break;

        let childItemCount = await client.storeItem.count({
          where: {
            storeOid: d.store.oid,
            parentDirectoryOid: directory.oid
          }
        });
        if (childItemCount > 0) break;

        let directoryItem = await this.getStoreItemByPath({
          store: d.store,
          path: directory.path
        });
        if (directoryItem) {
          await client.storeItem.delete({
            where: {
              id: directoryItem.id
            }
          });
          removedItemCount += 1;
        }

        let parentPath = normalizeStorePath({
          path: directory.path,
          kind: 'directory'
        }).parentPath;

        await client.storeDirectory.delete({
          where: {
            id: directory.id
          }
        });

        currentPath = parentPath;
      }

      return removedItemCount;
    });
  }

  private async ensureStoreRootDirectoryInTransaction(
    d: CargoTenantEnvironment & {
      store: Store;
      actor?: Pick<TenantActor, 'oid'>;
    }
  ) {
    return await withTransaction(async () => {
      let result = await this.ensureDirectoryHierarchy({
        tenant: d.tenant,
        environment: d.environment,
        store: d.store,
        path: normalizeStorePath({
          path: '/',
          kind: 'directory'
        }),
        actor: d.actor,
        includeSelf: true
      });

      return {
        item: result.item!,
        createdItemCount: result.createdItemCount
      };
    });
  }

  private async cleanupFileReference(fileReference: StoreItemRecord['reference']) {
    return await withTransaction(
      async () => {
        if (!fileReference) return;

        await fileReferenceService.deleteReferenceAndLinkIfUnused({
          fileReference
        });
      },
      { ifExists: true }
    );
  }

  private async updateContentStoreItem(
    d: CargoTenantEnvironment & {
      store: Store;
      item: StoreItemRecord;
      path: NormalizedStorePath;
      target?: ResolvedStoreItemTarget;
      actor?: Pick<TenantActor, 'oid'>;
    }
  ) {
    return await withTransaction(async client => {
      this.validateContentItem(d.item);

      let parentDirectory = await this.getStoreDirectoryByPath({
        store: d.store,
        path: d.path.parentPath!
      });
      if (!parentDirectory) {
        throw new ServiceError(
          badRequestError({
            message: `Store directory does not exist: ${d.path.parentPath}`
          })
        );
      }

      let nextPath = d.path.path;
      let targetChanged =
        !!d.target &&
        (d.item.fileOid !== d.target.file.oid ||
          (d.item.documentOid ?? null) !== (d.target.document?.oid ?? null));
      let nextKind = d.target ? this.getContentItemKind(d.target) : d.item.kind;

      if (nextPath !== d.item.path) {
        let conflictingItem = await client.storeItem.findFirst({
          where: {
            storeOid: d.item.storeOid,
            path: nextPath,
            NOT: {
              id: d.item.id
            }
          },
          select: {
            id: true
          }
        });

        if (conflictingItem) {
          throw new ServiceError(
            badRequestError({
              message: `Store item path already exists: ${nextPath}`
            })
          );
        }
      }

      let nextReferenceOid = d.item.referenceOid;

      if (targetChanged) {
        let reference = await this.createItemReference({
          tenant: d.tenant,
          environment: d.environment,
          itemId: d.item.id,
          target: d.target!
        });

        nextReferenceOid = reference.oid;
      }

      let updatedItem = await client.storeItem.update({
        where: {
          id: d.item.id
        },
        data: {
          kind: nextKind,
          path: nextPath,
          directoryOid: null,
          parentDirectoryOid: parentDirectory.oid,
          lastModifiedByTenantActorOid: d.actor ? d.actor.oid : undefined,
          fileOid: targetChanged ? d.target!.file.oid : undefined,
          documentOid: targetChanged ? (d.target!.document?.oid ?? null) : undefined,
          referenceOid: targetChanged ? nextReferenceOid : undefined
        },
        include: storeItemInclude
      });

      if (targetChanged) {
        await this.cleanupFileReference(d.item.reference);
      }

      return updatedItem;
    });
  }

  private async addContentStoreItem(
    d: CargoTenantEnvironment & {
      store: Store;
      path: NormalizedStorePath;
      target: ResolvedStoreItemTarget;
      actor?: Pick<TenantActor, 'oid'>;
    }
  ) {
    return await withTransaction(async client => {
      let parentDirectory = await this.getStoreDirectoryByPath({
        store: d.store,
        path: d.path.parentPath!
      });
      if (!parentDirectory) {
        throw new ServiceError(
          badRequestError({
            message: `Store directory does not exist: ${d.path.parentPath}`
          })
        );
      }

      let existingItem = await this.getStoreItemByPath({
        store: d.store,
        path: d.path.path
      });

      if (existingItem) {
        if (existingItem.kind === 'directory') {
          throw new ServiceError(
            badRequestError({
              message: `Store item path already exists: ${d.path.path}`
            })
          );
        }

        return {
          item: await this.updateContentStoreItem({
            tenant: d.tenant,
            environment: d.environment,
            store: d.store,
            item: existingItem,
            path: d.path,
            target: d.target,
            actor: d.actor
          }),
          created: false
        };
      }

      let itemIds = getId('storeItem');
      let reference = await this.createItemReference({
        tenant: d.tenant,
        environment: d.environment,
        itemId: itemIds.id,
        target: d.target
      });

      let createResult = await client.storeItem.createMany({
        data: [
          {
            oid: itemIds.oid,
            id: itemIds.id,
            kind: this.getContentItemKind(d.target),
            path: d.path.path,
            storeOid: d.store.oid,
            directoryOid: null,
            parentDirectoryOid: parentDirectory.oid,
            fileOid: d.target.file.oid,
            documentOid: d.target.document?.oid ?? null,
            referenceOid: reference.oid,
            lastModifiedByTenantActorOid: d.actor ? d.actor.oid : undefined
          }
        ],
        skipDuplicates: true
      });

      if (createResult.count === 1) {
        return {
          created: true,
          item: (await client.storeItem.findUnique({
            where: {
              id: itemIds.id
            },
            include: storeItemInclude
          }))!
        };
      }

      await this.cleanupFileReference(reference);

      let conflictingItem = await this.getStoreItemByPath({
        store: d.store,
        path: d.path.path
      });

      if (!conflictingItem) {
        throw new ServiceError(
          badRequestError({
            message: `Store item path already exists: ${d.path.path}`
          })
        );
      }

      if (conflictingItem.kind === 'directory') {
        throw new ServiceError(
          badRequestError({
            message: `Store item path already exists: ${d.path.path}`
          })
        );
      }

      return {
        item: await this.updateContentStoreItem({
          tenant: d.tenant,
          environment: d.environment,
          store: d.store,
          item: conflictingItem,
          path: d.path,
          target: d.target,
          actor: d.actor
        }),
        created: false
      };
    });
  }

  private async assertDirectoryIsEmpty(d: { store: Store; directory: StoreDirectory }) {
    return await withTransaction(
      async client => {
        let childItemCount = await client.storeItem.count({
          where: {
            storeOid: d.store.oid,
            parentDirectoryOid: d.directory.oid
          }
        });

        if (childItemCount > 0) {
          throw new ServiceError(
            badRequestError({
              message: `Directory is not empty: ${d.directory.path}`
            })
          );
        }
      },
      { ifExists: true }
    );
  }

  private async removeStoreItem(d: { store: Store; item: StoreItemRecord }) {
    return await withTransaction(async client => {
      if (d.item.kind === 'directory') {
        let normalizedPath = this.normalizeExistingItemPath(d.item);

        if (normalizedPath.path === '/') {
          throw new ServiceError(
            badRequestError({
              message: 'The root directory cannot be removed'
            })
          );
        }

        let directory = await this.getStoreDirectoryByPath({
          store: d.store,
          path: normalizedPath.path
        });
        if (!directory) {
          throw new ServiceError(notFoundError('storeDirectory', normalizedPath.path));
        }

        await this.assertDirectoryIsEmpty({
          store: d.store,
          directory
        });

        await client.storeItem.delete({
          where: {
            id: d.item.id
          }
        });
        await client.storeDirectory.delete({
          where: {
            id: directory.id
          }
        });

        return {
          item: d.item,
          removedItemCount: 1,
          pruneStartPath: d.item.parentDirectory?.path
            ? normalizeStorePath({
                path: d.item.parentDirectory.path,
                kind: 'directory'
              }).path
            : null
        };
      }

      await client.storeItem.delete({
        where: {
          id: d.item.id
        }
      });
      await this.cleanupFileReference(d.item.reference);

      return {
        item: d.item,
        removedItemCount: 1,
        pruneStartPath: d.item.parentDirectory?.path
          ? normalizeStorePath({
              path: d.item.parentDirectory.path,
              kind: 'directory'
            }).path
          : null
      };
    });
  }

  private async moveDirectoryItem(
    d: CargoTenantEnvironment & {
      store: Store;
      item: StoreItemRecord;
      nextPath: NormalizedStorePath;
      actor?: Pick<TenantActor, 'oid'>;
    }
  ) {
    return await withTransaction(async client => {
      let normalizedCurrentPath = this.normalizeExistingItemPath(d.item);

      if (normalizedCurrentPath.path === '/') {
        throw new ServiceError(
          badRequestError({
            message: 'The root directory cannot be moved'
          })
        );
      }

      let directory = await this.getStoreDirectoryByPath({
        store: d.store,
        path: normalizedCurrentPath.path
      });
      if (!directory) {
        throw new ServiceError(notFoundError('storeDirectory', normalizedCurrentPath.path));
      }

      await this.assertDirectoryIsEmpty({
        store: d.store,
        directory
      });

      if (d.nextPath.path === '/') {
        throw new ServiceError(
          badRequestError({
            message: 'Only the root directory can use the root path'
          })
        );
      }

      if (d.nextPath.path !== normalizedCurrentPath.path) {
        let conflictingItem = await client.storeItem.findFirst({
          where: {
            storeOid: d.store.oid,
            path: d.nextPath.path,
            NOT: {
              id: d.item.id
            }
          },
          select: {
            id: true
          }
        });

        if (conflictingItem) {
          throw new ServiceError(
            badRequestError({
              message: `Store item path already exists: ${d.nextPath.path}`
            })
          );
        }
      }

      let existingDirectory = await this.getStoreDirectoryByPath({
        store: d.store,
        path: d.nextPath.path
      });
      if (existingDirectory && existingDirectory.id !== directory.id) {
        throw new ServiceError(
          badRequestError({
            message: `Store directory path already exists: ${d.nextPath.path}`
          })
        );
      }

      let nextParentDirectory = await this.getStoreDirectoryByPath({
        store: d.store,
        path: d.nextPath.parentPath!
      });
      if (!nextParentDirectory) {
        throw new ServiceError(
          badRequestError({
            message: `Store directory does not exist: ${d.nextPath.parentPath}`
          })
        );
      }

      let previousParentPath = d.item.parentDirectory?.path
        ? normalizeStorePath({
            path: d.item.parentDirectory.path,
            kind: 'directory'
          }).path
        : null;

      await client.storeDirectory.update({
        where: {
          id: directory.id
        },
        data: {
          path: d.nextPath.path,
          parentDirectoryOid: nextParentDirectory.oid
        }
      });

      let updatedItem = await client.storeItem.update({
        where: {
          id: d.item.id
        },
        data: {
          path: d.nextPath.path,
          directoryOid: directory.oid,
          parentDirectoryOid: nextParentDirectory.oid,
          lastModifiedByTenantActorOid: d.actor ? d.actor.oid : undefined
        },
        include: storeItemInclude
      });

      return {
        item: updatedItem,
        pruneStartPath: previousParentPath
      };
    });
  }

  async attachTargetToStore(
    d: CargoTenantEnvironment & {
      store: Store;
      path: string;
      target: ResolvedStoreItemTarget;
      actor?: Pick<TenantActor, 'oid'>;
      allowReadOnly?: boolean;
    }
  ) {
    this.assertStoreWritable(d);

    return await withTransaction(async client => {
      let currentStore = (await client.store.findUnique({
        where: {
          id: d.store.id
        },
        select: {
          itemCount: true
        }
      }))!;
      let root = await this.ensureStoreRootDirectoryInTransaction(d);
      let itemCountDelta = root.createdItemCount;
      let skill = await this.getSkillForStore(d.store);
      let normalizedPath = normalizeStorePath({
        path: d.path,
        kind: 'file'
      });
      if (skill) {
        this.assertSkillStoreItemAllowed({
          path: normalizedPath,
          kind: this.getContentItemKind(d.target)
        });
      }

      let hierarchy = await this.ensureDirectoryHierarchy({
        tenant: d.tenant,
        environment: d.environment,
        store: d.store,
        path: normalizedPath,
        actor: d.actor
      });
      itemCountDelta += hierarchy.createdItemCount;

      let result = await this.addContentStoreItem({
        tenant: d.tenant,
        environment: d.environment,
        store: d.store,
        path: normalizedPath,
        target: d.target,
        actor: d.actor
      });
      if (result.created) {
        itemCountDelta += 1;
      }

      if (currentStore.itemCount + itemCountDelta > maxStoreItems) {
        throw new ServiceError(
          badRequestError({
            message: `Store cannot contain more than ${maxStoreItems} items`
          })
        );
      }

      if (itemCountDelta !== 0) {
        await client.store.update({
          where: {
            id: d.store.id
          },
          data: {
            itemCount: currentStore.itemCount + itemCountDelta
          }
        });
      }

      await storeVersionService.touchStoreLastEditedAt({
        storeOid: d.store.oid
      });

      await storeVersionService.markStoreDirtyIfNeeded({
        storeOid: d.store.oid
      });

      await enqueueStoreLifecycle({ storeId: d.store.id, event: 'contents-changed' });

      await this.syncSkillAgentForStoreItemTransition({
        skill,
        previousItem: null,
        nextItem: result.item
      });

      return result.item;
    });
  }

  async ensureStoreRootDirectory(
    d: CargoTenantEnvironment & {
      store: Store;
      actor?: Pick<TenantActor, 'oid'>;
    }
  ) {
    return await withTransaction(async client => {
      let result = await this.ensureStoreRootDirectoryInTransaction(d);
      if (result.createdItemCount > 0) {
        await client.store.update({
          where: {
            id: d.store.id
          },
          data: {
            itemCount: {
              increment: result.createdItemCount
            }
          }
        });
      }

      return result.item;
    });
  }

  async modifyStoreItems(
    d: CargoTenantEnvironment & {
      store: Store;
      operations: StoreItemOperationInput[];
      actor?: Pick<TenantActor, 'oid'>;
      allowReadOnly?: boolean;
    }
  ) {
    this.assertStoreWritable(d);

    if (d.operations.length > modifyOperationLimit) {
      throw new ServiceError(
        badRequestError({
          message: `A maximum of ${modifyOperationLimit} store operations can be submitted at once`
        })
      );
    }

    let operations = [];

    for (let operation of d.operations) {
      operations.push(
        await this.normalizeStoreItemOperation({
          tenant: d.tenant,
          environment: d.environment,
          operation
        })
      );
    }

    return await withTransaction(async client => {
      let results: StoreItemMutationResult[] = [];
      let currentStore = (await client.store.findUnique({
        where: {
          id: d.store.id
        },
        select: {
          itemCount: true
        }
      }))!;
      let root = await this.ensureStoreRootDirectoryInTransaction(d);
      let itemCount = currentStore.itemCount + root.createdItemCount;
      let skill = await this.getSkillForStore(d.store);

      if (itemCount > maxStoreItems) {
        throw new ServiceError(
          badRequestError({
            message: `Store cannot contain more than ${maxStoreItems} items`
          })
        );
      }

      for (let operation of operations) {
        if (operation.type === 'add') {
          if (skill) {
            this.assertSkillStoreItemAllowed({
              path: operation.path,
              kind: operation.kind
            });
          }

          if (operation.kind === 'directory') {
            let hierarchy = await this.ensureDirectoryHierarchy({
              tenant: d.tenant,
              environment: d.environment,
              store: d.store,
              path: operation.path,
              actor: d.actor,
              includeSelf: true,
              explicitSelf: true
            });
            itemCount += hierarchy.createdItemCount;

            if (itemCount > maxStoreItems) {
              throw new ServiceError(
                badRequestError({
                  message: `Store cannot contain more than ${maxStoreItems} items`
                })
              );
            }

            results.push({
              type: 'add',
              item: hierarchy.item ?? root.item
            });

            continue;
          }

          let hierarchy = await this.ensureDirectoryHierarchy({
            tenant: d.tenant,
            environment: d.environment,
            store: d.store,
            path: operation.path,
            actor: d.actor
          });
          itemCount += hierarchy.createdItemCount;

          let result = await this.addContentStoreItem({
            tenant: d.tenant,
            environment: d.environment,
            store: d.store,
            path: operation.path,
            target: operation.target!,
            actor: d.actor
          });
          if (result.created) {
            itemCount += 1;
          }

          if (itemCount > maxStoreItems) {
            throw new ServiceError(
              badRequestError({
                message: `Store cannot contain more than ${maxStoreItems} items`
              })
            );
          }

          results.push({
            type: 'add',
            item: result.item
          });
          await this.syncSkillAgentForStoreItemTransition({
            skill,
            previousItem: null,
            nextItem: result.item
          });

          continue;
        }

        let item = await this.getStoreItemRecord({
          store: d.store,
          itemId: operation.itemId
        });

        if (operation.type === 'remove') {
          if (skill) {
            this.assertSkillStoreRemoveAllowed(item);
            await this.syncSkillAgentForStoreItemTransition({
              skill,
              previousItem: item,
              nextItem: null
            });
          }

          let removedItem = await this.removeStoreItem({
            store: d.store,
            item
          });
          itemCount -= removedItem.removedItemCount;
          itemCount -= await this.pruneImplicitDirectories({
            store: d.store,
            startPath: removedItem.pruneStartPath
          });

          results.push({
            type: 'remove',
            item: removedItem.item
          });

          continue;
        }

        if (item.kind === 'directory') {
          let normalizedCurrentPath = this.normalizeExistingItemPath(item);
          if (normalizedCurrentPath.path === '/') {
            throw new ServiceError(
              badRequestError({
                message: 'The root directory cannot be modified'
              })
            );
          }

          if (operation.target) {
            throw new ServiceError(
              badRequestError({
                message: 'Directory items cannot be updated with file or document targets'
              })
            );
          }

          if (!operation.path) {
            results.push({
              type: 'modify',
              item
            });

            continue;
          }

          let nextPath = normalizeStorePath({
            path: operation.path,
            kind: 'directory'
          });
          if (skill) {
            this.assertSkillStoreModifyAllowed({
              item,
              nextPath,
              nextKind: 'directory'
            });
          }

          let hierarchy = await this.ensureDirectoryHierarchy({
            tenant: d.tenant,
            environment: d.environment,
            store: d.store,
            path: nextPath,
            actor: d.actor
          });
          itemCount += hierarchy.createdItemCount;

          let movedItem = await this.moveDirectoryItem({
            tenant: d.tenant,
            environment: d.environment,
            store: d.store,
            item,
            nextPath,
            actor: d.actor
          });
          itemCount -= await this.pruneImplicitDirectories({
            store: d.store,
            startPath: movedItem.pruneStartPath
          });

          if (itemCount > maxStoreItems) {
            throw new ServiceError(
              badRequestError({
                message: `Store cannot contain more than ${maxStoreItems} items`
              })
            );
          }

          results.push({
            type: 'modify',
            item: movedItem.item
          });

          continue;
        }

        let nextPath = normalizeStorePath({
          path: operation.path ?? item.path,
          kind: 'file'
        });
        let nextKind = operation.target
          ? this.getContentItemKind(operation.target)
          : item.kind;
        if (skill) {
          this.assertSkillStoreModifyAllowed({
            item,
            nextPath,
            nextKind
          });
        }

        let previousParentPath = item.parentDirectory?.path
          ? normalizeStorePath({
              path: item.parentDirectory.path,
              kind: 'directory'
            }).path
          : null;
        let hierarchy = await this.ensureDirectoryHierarchy({
          tenant: d.tenant,
          environment: d.environment,
          store: d.store,
          path: nextPath,
          actor: d.actor
        });
        itemCount += hierarchy.createdItemCount;

        let updatedItem = await this.updateContentStoreItem({
          tenant: d.tenant,
          environment: d.environment,
          store: d.store,
          item,
          path: nextPath,
          target: operation.target,
          actor: d.actor
        });

        results.push({
          type: 'modify',
          item: updatedItem
        });
        await this.syncSkillAgentForStoreItemTransition({
          skill,
          previousItem: item,
          nextItem: updatedItem
        });

        itemCount -= await this.pruneImplicitDirectories({
          store: d.store,
          startPath: previousParentPath
        });

        if (itemCount > maxStoreItems) {
          throw new ServiceError(
            badRequestError({
              message: `Store cannot contain more than ${maxStoreItems} items`
            })
          );
        }
      }

      if (itemCount !== currentStore.itemCount) {
        await client.store.update({
          where: {
            id: d.store.id
          },
          data: {
            itemCount
          }
        });
      }

      if (results.length > 0) {
        await storeVersionService.touchStoreLastEditedAt({
          storeOid: d.store.oid
        });

        await storeVersionService.markStoreDirtyIfNeeded({
          storeOid: d.store.oid
        });

        await enqueueStoreLifecycle({ storeId: d.store.id, event: 'contents-changed' });
      }

      return results;
    });
  }
}

export let storeItemMutationService = Service.create(
  'cargoStoreItemMutationService',
  () => new StoreItemMutationServiceImpl()
).build();
