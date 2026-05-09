import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, PrismaClient, Store } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { storeCleanupManyQueue } from '../queues/storeCleanup';
import type { CargoTenantEnvironment } from './filePurpose';
import { fileReferenceService } from './fileReference';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission,
  type StoreAccessInput
} from './storeAccess';
import { storeItemMutationService, type StoreItemOperationInput } from './storeItemMutation';

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
        environmentOid: d.environment.oid
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
}

export let storeService = Service.create(
  'cargoStoreService',
  () => new StoreServiceImpl()
).build();
