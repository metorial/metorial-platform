import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { cargo, type CargoStore } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStoreAccess,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';
import { storeItemService } from './storeItem';

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
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
    input: {
      id?: string;
      name: string;
      access?: CargoStoreAccess;
      templateId?: string;
      parentId?: string;
    };
  }) {
    let { scope, actorId } = await resolveCargoAccess(d);

    return await cargo.store.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.input.id,
      name: d.input.name,
      access: d.input.access,
      actorId,
      templateId: d.input.templateId,
      parentId: d.input.parentId
    });
  }

  async listStores(d: {
    owner: FileOwner;
    ids?: string[];
    createdAt?: { gt?: Date; lt?: Date };
    updatedAt?: { gt?: Date; lt?: Date };
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.store.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        actorId,
        defaultPermissions,
        overridePermissions,
        storeIds: d.ids,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
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
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    return await cargo.store.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.storeId,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async getStorePermissions(d: {
    owner: FileOwner;
    storeId: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    return await cargo.store.getPermissions({
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
      access?: CargoStoreAccess;
    };
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    return await cargo.store.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.store.id,
      name: d.input.name,
      access: d.input.access,
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
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

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
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    let items = await cargo.store.modifyItems({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.store.id,
      operations: d.operations as any,
      actorId,
      defaultPermissions,
      overridePermissions
    });

    let enrichedItems = await storeItemService.enrichStoreItems({
      owner: d.owner,
      storeItems: items.map(item => item.item)
    });

    return items.map((item, index) => ({
      ...item,
      item: enrichedItems[index]!
    }));
  }
}

export let storeService = Service.create('fileStore', () => new StoreServiceImpl()).build();
