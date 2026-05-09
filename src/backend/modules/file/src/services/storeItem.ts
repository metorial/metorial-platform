import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo } from '../cargo';
import { resolveCargoAccess, type CargoAccessActor, type CargoStorePermission } from './access';
import type { FileOwner } from './file';

class StoreItemServiceImpl {
  async getStoreItemById(d: {
    owner: FileOwner;
    itemId: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.storeItem.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      itemId: d.itemId,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async listStoreItems(d: {
    owner: FileOwner;
    storeId?: string;
    fileId?: string;
    documentId?: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.storeItem.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        storeId: d.storeId,
        fileId: d.fileId,
        documentId: d.documentId,
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
}

export let storeItemService = Service.create(
  'fileStoreItem',
  () => new StoreItemServiceImpl()
).build();
