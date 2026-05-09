import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo } from '../cargo';
import type { FileOwner } from './file';
import { resolveCargoScopeForOwner } from './scope';

class StoreItemServiceImpl {
  private async getScope(owner: FileOwner) {
    return await resolveCargoScopeForOwner(owner);
  }

  async getStoreItemById(d: { owner: FileOwner; itemId: string }) {
    let scope = await this.getScope(d.owner);

    return await cargo.storeItem.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      itemId: d.itemId
    });
  }

  async listStoreItems(d: {
    owner: FileOwner;
    storeId?: string;
    fileId?: string;
    documentId?: string;
  }) {
    let scope = await this.getScope(d.owner);

    return Paginator.create(() => async input => {
      let result = await cargo.storeItem.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        storeId: d.storeId,
        fileId: d.fileId,
        documentId: d.documentId,
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
