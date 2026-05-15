import { documentPresenter } from './document';
import { filePresenter } from './file';
import type { StoreItemRecord } from '@metorial-cargo/module-store';

export let storeItemPresenter = (item: StoreItemRecord) => ({
  object: 'cargo#store_item',
  id: item.id,
  kind: item.kind,
  path: item.path,
  storeId: item.store.id,
  parentDirectoryId: item.parentDirectory?.id,
  fileId: item.file?.id,
  documentId: item.document?.id ?? item.file?.document?.id,
  referenceId: item.reference?.id,
  file: item.file ? filePresenter(item.file) : undefined,
  document: item.document ? documentPresenter(item.document) : undefined,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});
