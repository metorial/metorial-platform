import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { storeItemType } from '../types';
import { v1DocumentPresenter } from './document';
import { v1FilePresenter } from './file';

export let v1StoreItemPresenter = Presenter.create(storeItemType)
  .presenter(async ({ storeItem }, opts) => ({
    object: 'store.item',
    id: storeItem.id,
    kind: storeItem.kind,
    path: storeItem.path,
    store_id: storeItem.storeId,
    parent_directory_id: storeItem.parentDirectoryId ?? null,
    file_id: storeItem.fileId ?? null,
    document_id: storeItem.documentId ?? null,
    reference_id: storeItem.referenceId ?? null,
    file: storeItem.file ? await v1FilePresenter.present({ file: storeItem.file }, opts).run() : null,
    document: storeItem.document
      ? await v1DocumentPresenter.present({ document: storeItem.document }, opts).run()
      : null,
    created_at: storeItem.createdAt,
    updated_at: storeItem.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('store.item', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      kind: v.enumOf(['file', 'document', 'directory']),
      path: v.string(),
      store_id: v.string(),
      parent_directory_id: v.nullable(v.string()),
      file_id: v.nullable(v.string()),
      document_id: v.nullable(v.string()),
      reference_id: v.nullable(v.string()),
      file: v.nullable(v1FilePresenter.schema),
      document: v.nullable(v1DocumentPresenter.schema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
