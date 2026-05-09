import { documentPresenter } from './document';
import { filePresenter } from './file';
import type { StoreItemRecord } from '../services/storeItem';

export let storeItemPresenter = (item: StoreItemRecord) => ({
  object: 'cargo#store_item',
  id: item.id,
  path: item.path,
  storeId: item.store.id,
  fileId: item.file.id,
  documentId: item.document?.id ?? item.file.document?.id,
  referenceId: item.reference.id,
  file: filePresenter(item.file),
  document: item.document ? documentPresenter(item.document) : undefined,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});
