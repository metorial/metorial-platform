import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { storeItemType } from '../../types';
import { v1DocumentPresenter } from './document';
import { v1FilePresenter } from './file';

export let v1StoreItemPresenter = Presenter.create(storeItemType)
  .presenter(async ({ storeItem }, opts) => ({
    object: 'store.item',
    id: storeItem.id,
    kind: storeItem.kind,
    path: storeItem.path,
    store_id: storeItem.storeId,
    directory_id: storeItem.parentDirectoryId ?? null,

    file: storeItem.file
      ? await v1FilePresenter.present({ file: storeItem.file }, opts).run()
      : null,
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
      directory_id: v.nullable(v.string()),
      file: v.nullable(v1FilePresenter.schema),
      document: v.nullable(v1DocumentPresenter.schema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
