import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, PrismaClient, Store } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { storeCleanupManyQueue } from '../queues/storeCleanup';
import { documentInclude, documentService } from './document';
import type { CargoTenantEnvironment } from './filePurpose';
import { fileReferenceService } from './fileReference';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission,
  type StoreAccessInput
} from './storeAccess';
import { storeItemInclude, type StoreItemRecord } from './storeItem';
import { storeItemMutationService, type StoreItemOperationInput } from './storeItemMutation';
import { storeVersionService } from './storeVersion';

type DbClient = PrismaClient | Prisma.TransactionClient;

class StoreServiceImpl {
  private async getStoreRecord(
    client: DbClient,
    d: CargoTenantEnvironment & {
      storeId: string;
    }
  ) {
    let store = await client.store.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.storeId
      }
    });

    if (!store) throw new ServiceError(notFoundError('store', d.storeId));

    return store;
  }

  async createStore(
    d: CargoTenantEnvironment & {
      client?: DbClient;
      input: {
        id?: string;
        name: string;
        parentStore?: Store;
      };
    }
  ) {
    let storeIds = d.input.id ? { oid: getId('store').oid, id: d.input.id } : getId('store');
    let client = d.client ?? db;

    return await client.store.create({
      data: {
        oid: storeIds.oid,
        id: storeIds.id,
        name: d.input.name,
        itemCount: 0,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        parentStoreOid: d.input.parentStore?.oid
      }
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
    let store = await this.getStoreRecord(db, d);
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
        };
      }
  ) {
    if (d.input.name === undefined) {
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
        name: d.input.name
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

    return await db.$transaction(async tx => {
      let clonedStore = await this.createStore({
        tenant: d.tenant,
        environment: d.environment,
        client: tx,
        input: {
          id: d.input.id,
          name: d.input.name ?? d.store.name,
          parentStore: d.store
        }
      });

      let items = await tx.storeItem.findMany({
        where: {
          storeOid: d.store.oid
        },
        include: storeItemInclude,
        orderBy: {
          createdAt: 'asc'
        }
      });

      for (let item of items) {
        await this.cloneStoreItemIntoStore(tx, {
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
        storeOid: clonedStore.oid,
        client: tx
      });

      return (await tx.store.findUnique({
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

    let { deletedStore, fileReferenceIds } = await db.$transaction(async client => {
      let items = await client.storeItem.findMany({
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

      let deletedStore = await client.store.delete({
        where: {
          id: d.store.id
        }
      });

      return {
        deletedStore,
        fileReferenceIds: items.map(item => item.reference.id)
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
    client: DbClient,
    d: CargoTenantEnvironment &
      StoreAccessInput & {
        targetStore: Store;
        item: StoreItemRecord;
        actor: Awaited<
          ReturnType<typeof storeAccessService.assertStoreAccessForStore>
        >['actor'];
      }
  ) {
    if (d.item.document) {
      let sourceDocument = await client.document.findFirst({
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
        client,
        input: {}
      });

      await storeItemMutationService.attachTargetToStore({
        tenant: d.tenant,
        environment: d.environment,
        store: d.targetStore,
        path: d.item.path,
        target: {
          file: clonedDocument.file,
          document: {
            oid: clonedDocument.oid,
            id: clonedDocument.id
          }
        },
        actor: d.actor,
        client
      });

      return;
    }

    await storeItemMutationService.attachTargetToStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.targetStore,
      path: d.item.path,
      target: {
        file: d.item.file,
        document: null
      },
      actor: d.actor,
      client
    });
  }
}

export let storeService = Service.create(
  'cargoStoreService',
  () => new StoreServiceImpl()
).build();
