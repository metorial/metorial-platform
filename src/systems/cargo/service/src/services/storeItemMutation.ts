import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Prisma, PrismaClient, Store, TenantActor } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import { fileLinkService } from './fileLink';
import type { CargoTenantEnvironment } from './filePurpose';
import { fileReferenceService } from './fileReference';
import { storeItemInclude, type StoreItemRecord } from './storeItem';
import { storeVersionService } from './storeVersion';

type DbClient = PrismaClient | Prisma.TransactionClient;

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
      path: string;
      target: ResolvedStoreItemTarget;
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

class StoreItemMutationServiceImpl {
  private async getStoreItemRecord(
    client: DbClient,
    d: {
      store: Pick<Store, 'oid'>;
      itemId: string;
    }
  ) {
    let item = await client.storeItem.findFirst({
      where: {
        storeOid: d.store.oid,
        id: d.itemId
      },
      include: storeItemInclude
    });

    if (!item) throw new ServiceError(notFoundError('storeItem', d.itemId));

    return item;
  }

  private async getStoreItemByPath(
    client: DbClient,
    d: {
      store: Pick<Store, 'oid'>;
      path: string;
    }
  ) {
    return await client.storeItem.findFirst({
      where: {
        storeOid: d.store.oid,
        path: d.path
      },
      include: storeItemInclude
    });
  }

  private validatePath(path: string | undefined) {
    if (!path) {
      throw new ServiceError(
        badRequestError({
          message: 'Store item path is required'
        })
      );
    }

    if (!path.trim()) {
      throw new ServiceError(
        badRequestError({
          message: 'Store item path cannot be empty'
        })
      );
    }
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
      this.validatePath(operation.path);
      let target = await this.resolveStoreItemTarget({
        tenant: d.tenant,
        environment: d.environment,
        fileId: operation.fileId,
        documentId: operation.documentId
      });

      return {
        type: 'add',
        path: operation.path!,
        target: target!
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

    if (operation.path !== undefined) {
      this.validatePath(operation.path);
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
    client: DbClient,
    d: CargoTenantEnvironment & {
      itemId: string;
      target: ResolvedStoreItemTarget;
    }
  ) {
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
  }

  private async cleanupFileReference(
    client: DbClient,
    fileReference: StoreItemRecord['reference']
  ) {
    await fileReferenceService.deleteReferenceAndLinkIfUnused({
      fileReference
    });
  }

  private async updateStoreItem(
    client: DbClient,
    d: CargoTenantEnvironment & {
      item: StoreItemRecord;
      path?: string;
      target?: ResolvedStoreItemTarget;
      actor?: Pick<TenantActor, 'oid'>;
    }
  ) {
    let nextPath = d.path ?? d.item.path;
    let targetChanged =
      !!d.target &&
      (d.item.fileOid !== d.target.file.oid ||
        (d.item.documentOid ?? null) !== (d.target.document?.oid ?? null));

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
      let reference = await this.createItemReference(client, {
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
        path: nextPath,
        ...(d.actor
          ? {
              lastModifiedByTenantActorOid: d.actor.oid
            }
          : {}),
        ...(targetChanged
          ? {
              fileOid: d.target!.file.oid,
              documentOid: d.target!.document?.oid ?? null,
              referenceOid: nextReferenceOid
            }
          : {})
      },
      include: storeItemInclude
    });

    if (targetChanged) {
      await this.cleanupFileReference(client, d.item.reference);
    }

    return updatedItem;
  }

  private async addStoreItem(
    client: DbClient,
    d: CargoTenantEnvironment & {
      store: Store;
      path: string;
      target: ResolvedStoreItemTarget;
      actor?: Pick<TenantActor, 'oid'>;
    }
  ) {
    let existingItem = await this.getStoreItemByPath(client, {
      store: d.store,
      path: d.path
    });

    if (existingItem) {
      return {
        item: await this.updateStoreItem(client, {
          tenant: d.tenant,
          environment: d.environment,
          item: existingItem,
          target: d.target,
          actor: d.actor
        }),
        created: false
      };
    }

    let itemIds = getId('storeItem');
    let reference = await this.createItemReference(client, {
      tenant: d.tenant,
      environment: d.environment,
      itemId: itemIds.id,
      target: d.target
    });

    return {
      created: true,
      item: await client.storeItem.create({
        data: {
          oid: itemIds.oid,
          id: itemIds.id,
          path: d.path,
          storeOid: d.store.oid,
          fileOid: d.target.file.oid,
          documentOid: d.target.document?.oid ?? null,
          referenceOid: reference.oid,
          ...(d.actor
            ? {
                lastModifiedByTenantActorOid: d.actor.oid
              }
            : {})
        },
        include: storeItemInclude
      })
    };
  }

  private async removeStoreItem(client: DbClient, item: StoreItemRecord) {
    await client.storeItem.delete({
      where: {
        id: item.id
      }
    });
    await this.cleanupFileReference(client, item.reference);

    return item;
  }

  async attachTargetToStore(
    d: CargoTenantEnvironment & {
      store: Store;
      path: string;
      target: ResolvedStoreItemTarget;
      actor?: Pick<TenantActor, 'oid'>;
    }
  ) {
    return await withTransaction(async client => {
      let result = await this.addStoreItem(client, d);

      if (result.created) {
        await client.store.update({
          where: {
            id: d.store.id
          },
          data: {
            itemCount: {
              increment: 1
            }
          }
        });
      }

      await storeVersionService.markStoreDirtyIfNeeded({
        storeOid: d.store.oid
      });

      return result.item;
    });
  }

  async modifyStoreItems(
    d: CargoTenantEnvironment & {
      store: Store;
      operations: StoreItemOperationInput[];
      actor?: Pick<TenantActor, 'oid'>;
    }
  ) {
    if (d.operations.length > modifyOperationLimit) {
      throw new ServiceError(
        badRequestError({
          message: `A maximum of ${modifyOperationLimit} store operations can be submitted at once`
        })
      );
    }

    let projectedItemCount =
      d.store.itemCount +
      d.operations.filter(operation => {
        let type =
          operation.type ??
          (operation.itemId
            ? operation.path || operation.fileId || operation.documentId
              ? 'modify'
              : 'remove'
            : 'add');

        return type === 'add';
      }).length -
      d.operations.filter(operation => {
        let type =
          operation.type ??
          (operation.itemId
            ? operation.path || operation.fileId || operation.documentId
              ? 'modify'
              : 'remove'
            : 'add');

        return type === 'remove';
      }).length;

    if (projectedItemCount > maxStoreItems) {
      throw new ServiceError(
        badRequestError({
          message: `Store cannot contain more than ${maxStoreItems} items`
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

      for (let operation of operations) {
        if (operation.type === 'add') {
          let result = await this.addStoreItem(client, {
            tenant: d.tenant,
            environment: d.environment,
            store: d.store,
            path: operation.path,
            target: operation.target,
            actor: d.actor
          });

          if (result.created) {
            await client.store.update({
              where: {
                id: d.store.id
              },
              data: {
                itemCount: {
                  increment: 1
                }
              }
            });
          }

          results.push({
            type: 'add',
            item: result.item
          });

          continue;
        }

        let item = await this.getStoreItemRecord(client, {
          store: d.store,
          itemId: operation.itemId
        });

        if (operation.type === 'remove') {
          let removedItem = await this.removeStoreItem(client, item);
          await client.store.update({
            where: {
              id: d.store.id
            },
            data: {
              itemCount: {
                decrement: 1
              }
            }
          });

          results.push({
            type: 'remove',
            item: removedItem
          });

          continue;
        }

        results.push({
          type: 'modify',
          item: await this.updateStoreItem(client, {
            tenant: d.tenant,
            environment: d.environment,
            item,
            path: operation.path,
            target: operation.target,
            actor: d.actor
          })
        });
      }

      if (results.length > 0) {
        await storeVersionService.markStoreDirtyIfNeeded({
          storeOid: d.store.oid
        });
      }

      return results;
    });
  }
}

export let storeItemMutationService = Service.create(
  'cargoStoreItemMutationService',
  () => new StoreItemMutationServiceImpl()
).build();
