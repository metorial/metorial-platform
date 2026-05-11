import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Store, StoreAccess } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import { storeCleanupManyQueue } from '../queues/storeCleanup';
import { documentInclude, documentService } from './document';
import type { CargoTenantEnvironment } from './filePurpose';
import { fileReferenceService } from './fileReference';
import { normalizeStorePath } from '../lib/storePath';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission,
  type StoreAccessInput
} from './storeAccess';
import { storeItemInclude, type StoreItemRecord } from './storeItem';
import { storeItemMutationService, type StoreItemOperationInput } from './storeItemMutation';
import { storeVersionService } from './storeVersion';

class StoreServiceImpl {
  private async getStoreRecord(d: CargoTenantEnvironment & { storeId: string }) {
    return await withTransaction(
      async db => {
        let store = await db.store.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            id: d.storeId
          }
        });

        if (!store) throw new ServiceError(notFoundError('store', d.storeId));

        return store;
      },
      { ifExists: true }
    );
  }

  async createStore(
    d: CargoTenantEnvironment & {
      input: {
        id?: string;
        name: string;
        access?: StoreAccess;
        parentStore?: Store;
      };
    }
  ) {
    return await withTransaction(async db => {
      let storeIds = d.input.id ? { oid: getId('store').oid, id: d.input.id } : getId('store');

      let createdStore = await db.store.create({
        data: {
          oid: storeIds.oid,
          id: storeIds.id,
          name: d.input.name,
          access: d.input.access ?? 'private',
          itemCount: 0,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          parentStoreOid: d.input.parentStore?.oid
        }
      });

      await storeItemMutationService.ensureStoreRootDirectory({
        tenant: d.tenant,
        environment: d.environment,
        store: createdStore
      });

      return (await db.store.findUnique({
        where: {
          id: createdStore.id
        }
      }))!;
    });
  }

  async listStores(d: CargoTenantEnvironment & StoreAccessInput) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let accessibleStoreOids = d.actorId
          ? (
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

        return await db.store.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            oid: accessibleStoreOids
              ? {
                  in: accessibleStoreOids
                }
              : undefined
          }
        });
      })
    );
  }

  async getStoreById(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        storeId: string;
      }
  ) {
    let store = await this.getStoreRecord(d);
    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return store;
  }

  async updateStore(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        store: Store;
        input: {
          name?: string;
          access?: StoreAccess;
        };
      }
  ) {
    if (d.input.name === undefined && d.input.access === undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one store field must be updated'
        })
      );
    }

    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    return await db.store.update({
      where: {
        id: d.store.id
      },
      data: {
        name: d.input.name,
        access: d.input.access
      }
    });
  }

  async cloneStore(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        store: Store;
        input: {
          id?: string;
          name?: string;
          access?: StoreAccess;
        };
      }
  ) {
    let access = await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return await withTransaction(async db => {
      let clonedStore = await this.createStore({
        tenant: d.tenant,
        environment: d.environment,
        input: {
          id: d.input.id,
          name: d.input.name ?? d.store.name,
          access: d.input.access ?? d.store.access,
          parentStore: d.store
        }
      });

      let items = await db.storeItem.findMany({
        where: {
          storeOid: d.store.oid
        },
        include: storeItemInclude,
        orderBy: {
          createdAt: 'asc'
        }
      });

      for (let item of items) {
        await this.cloneStoreItemIntoStore({
          tenant: d.tenant,
          environment: d.environment,
          targetStore: clonedStore,
          item,
          actorId: d.actorId,
          defaultPermissions: d.defaultPermissions,
          overridePermissions: d.overridePermissions,
          actor: access.actor
        });
      }

      await storeVersionService.markStoreDirtyIfNeeded({
        storeOid: clonedStore.oid
      });

      return (await db.store.findUnique({
        where: {
          id: clonedStore.id
        }
      }))!;
    });
  }

  async deleteStore(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        store: Store;
        allowLinkedSkillDelete?: boolean;
      }
  ) {
    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    if (!d.allowLinkedSkillDelete) {
      let linkedSkill = await db.skill.findFirst({
        where: {
          storeOid: d.store.oid
        },
        select: {
          id: true
        }
      });

      if (linkedSkill) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot delete store: it is linked to a skill'
          })
        );
      }
    }

    let { deletedStore, fileReferenceIds } = await withTransaction(async db => {
      let items = await db.storeItem.findMany({
        where: {
          storeOid: d.store.oid
        },
        select: {
          reference: {
            select: {
              id: true
            }
          }
        }
      });

      let deletedStore = await db.store.delete({
        where: {
          id: d.store.id
        }
      });

      return {
        deletedStore,
        fileReferenceIds: items
          .map(item => item.reference?.id)
          .filter((id): id is string => !!id)
      };
    });

    if (fileReferenceIds.length > 0) {
      await storeCleanupManyQueue.add({
        fileReferenceIds
      });
    }

    return deletedStore;
  }

  async cleanupStoreFileReference(d: { fileReferenceId: string }) {
    await fileReferenceService.deleteFileReferenceByIdAndCleanup({
      fileReferenceId: d.fileReferenceId
    });
  }

  async modifyStoreItems(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        store: Store;
        operations: StoreItemOperationInput[];
      }
  ) {
    let access = await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    return await storeItemMutationService.modifyStoreItems({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      operations: d.operations,
      actor: access.actor
    });
  }

  private async cloneStoreItemIntoStore(
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        targetStore: Store;
        item: StoreItemRecord;
        actor: Awaited<
          ReturnType<typeof storeAccessService.assertStoreAccessForStore>
        >['actor'];
      }
  ) {
    return await withTransaction(async db => {
      let normalizedItemPath = normalizeStorePath({
        path: d.item.path,
        kind: d.item.kind === 'directory' ? 'directory' : 'file'
      });

      if (d.item.kind === 'directory') {
        if (normalizedItemPath.path === '/') {
          return;
        }

        let sourceDirectory = await db.storeDirectory.findFirst({
          where: {
            storeOid: d.item.storeOid,
            path: normalizedItemPath.path
          }
        });

        if (!sourceDirectory?.isAutoCreated) {
          await storeItemMutationService.modifyStoreItems({
            tenant: d.tenant,
            environment: d.environment,
            store: d.targetStore,
            operations: [
              {
                type: 'add',
                path: normalizedItemPath.path
              }
            ],
            actor: d.actor ?? undefined
          });
        }

        return;
      }

      if (d.item.document) {
        let sourceDocument = await db.document.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            id: d.item.document.id
          },
          include: documentInclude
        });

        if (!sourceDocument) {
          throw new ServiceError(notFoundError('document', d.item.document.id));
        }

        let clonedDocument = await documentService.cloneDocument({
          tenant: d.tenant,
          environment: d.environment,
          document: sourceDocument,
          input: {}
        });

        await storeItemMutationService.attachTargetToStore({
          tenant: d.tenant,
          environment: d.environment,
          store: d.targetStore,
          path: normalizedItemPath.path,
          target: {
            file: clonedDocument.file,
            document: {
              oid: clonedDocument.oid,
              id: clonedDocument.id
            }
          },
          actor: d.actor
        });

        return;
      }

      if (!d.item.file) {
        throw new ServiceError(notFoundError('file', d.item.id));
      }

      await storeItemMutationService.attachTargetToStore({
        tenant: d.tenant,
        environment: d.environment,
        store: d.targetStore,
        path: normalizedItemPath.path,
        target: {
          file: d.item.file,
          document: null
        },
        actor: d.actor
      });
    });
  }
}

export let storeService = Service.create(
  'cargoStoreService',
  () => new StoreServiceImpl()
).build();
