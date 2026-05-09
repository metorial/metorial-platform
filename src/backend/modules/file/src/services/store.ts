import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoStore } from '../cargo';
import type { FileOwner } from './file';
import { resolveCargoAccess, type CargoAccessActor, type CargoStorePermission } from './access';

export type CargoStoreItemOperation = {
  type?: 'add' | 'modify' | 'remove';
  itemId?: string;
  fileId?: string;
  documentId?: string;
  path?: string;
};

class StoreServiceImpl {
  async createStore(d: {
    owner: FileOwner;
    input: {
      id?: string;
      name: string;
    };
  }) {
    let { scope } = await resolveCargoAccess({
      owner: d.owner
    });

    return await cargo.store.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.input.id,
      name: d.input.name
    });
  }

  async listStores(d: {
    owner: FileOwner;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.store.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        actorId,
        defaultPermissions,
        overridePermissions,
        ...input
      });

      return {
        items: result.items,
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getStoreById(d: {
    owner: FileOwner;
    storeId: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.store.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.storeId,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async updateStore(d: {
    owner: FileOwner;
    store: CargoStore;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
    input: {
      name?: string;
    };
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.store.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.store.id,
      name: d.input.name,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async deleteStore(d: {
    owner: FileOwner;
    store: CargoStore;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.store.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.store.id,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async modifyStoreItems(d: {
    owner: FileOwner;
    store: CargoStore;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
    operations: CargoStoreItemOperation[];
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.store.modifyItems({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.store.id,
      operations: d.operations as any,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }
}

export let storeService = Service.create('fileStore', () => new StoreServiceImpl()).build();
