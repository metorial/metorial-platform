import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoStoreItem } from '../cargo';
import type { CargoStoreItemType } from '../cargo';
import { resolveCargoAccess, type CargoAccessActor, type CargoStorePermission } from './access';
import { documentService, type EnrichedCargoDocument } from './document';
import { fileService, type EnrichedCargoFile, type FileOwner } from './file';

export type EnrichedCargoStoreItem = Omit<CargoStoreItem, 'file' | 'document'> & {
  file: EnrichedCargoFile | null;
  document: EnrichedCargoDocument | null;
};

class StoreItemServiceImpl {
  async enrichStoreItems(d: {
    owner: FileOwner;
    storeItems: CargoStoreItem[];
  }): Promise<EnrichedCargoStoreItem[]> {
    let files = d.storeItems.flatMap(storeItem => (storeItem.file ? [storeItem.file] : []));
    let documents = d.storeItems.flatMap(storeItem =>
      storeItem.document ? [storeItem.document] : []
    );

    let enrichedFiles = await fileService.enrichFiles({
      owner: d.owner,
      files
    });
    let enrichedDocuments = await documentService.enrichDocuments({
      owner: d.owner,
      documents
    });

    let nextFileIndex = 0;
    let nextDocumentIndex = 0;

    return d.storeItems.map(storeItem => ({
      ...storeItem,
      file: storeItem.file ? (enrichedFiles[nextFileIndex++] ?? null) : null,
      document: storeItem.document
        ? (enrichedDocuments[nextDocumentIndex++] ?? null)
        : null
    }));
  }

  async enrichStoreItem(d: {
    owner: FileOwner;
    storeItem: CargoStoreItem;
  }): Promise<EnrichedCargoStoreItem> {
    let [storeItem] = await this.enrichStoreItems({
      owner: d.owner,
      storeItems: [d.storeItem]
    });

    return storeItem!;
  }

  async getStoreItemById(d: {
    owner: FileOwner;
    itemId: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    let storeItem = await cargo.storeItem.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      itemId: d.itemId,
      actorId,
      defaultPermissions,
      overridePermissions
    });

    return await this.enrichStoreItem({ owner: d.owner, storeItem });
  }

  async listStoreItems(d: {
    owner: FileOwner;
    storeId: string;
    fileIds?: string[];
    documentIds?: string[];
    types?: CargoStoreItemType[];
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
        fileIds: d.fileIds,
        documentIds: d.documentIds,
        types: d.types,
        actorId,
        defaultPermissions,
        overridePermissions,
        ...input
      });

      return {
        items: await this.enrichStoreItems({
          owner: d.owner,
          storeItems: result.items
        }),
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
