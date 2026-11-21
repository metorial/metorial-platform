import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { storeItemListType, storeItemType } from '../../types';
import { v1DocumentPresenter } from './document';
import { v1FilePresenter } from './file';

export let v1StoreItemPresenter = Presenter.create(storeItemType)
  .presenter(async ({ storeItem }, opts) => ({
    object: 'store.item',
    id: storeItem.id,
    kind: storeItem.kind,
    path: storeItem.path,
    store_id: storeItem.store.id,
    directory_id: storeItem.parentDirectory?.id ?? null,

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
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      kind: v.enumOf(['file', 'document', 'directory'], {
        description: 'What the item holds: `file`, `document`, or `directory`.'
      }),
      path: v.string({ description: 'Path of the item within the store.' }),
      store_id: v.string({ description: 'Store the item belongs to.' }),
      directory_id: v.nullable(
        v.string({ description: 'Parent directory, by ID. `null` for top-level items.' })
      ),
      file: v.nullable(v1FilePresenter.schema, {
        description: 'File at this item. `null` unless `kind` is `file`.'
      }),
      document: v.nullable(v1DocumentPresenter.schema, {
        description: 'Document at this item. `null` unless `kind` is `document`.'
      }),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();

export let v1StoreItemListPresenter = Presenter.create(storeItemListType)
  .presenter(async ({ storeItems }, opts) => ({
    object: 'list(store.item)',
    items: await Promise.all(
      storeItems.map(storeItem => v1StoreItemPresenter.present({ storeItem }, opts).run())
    )
  }))
  .schema(
    v.object({
      object: v.literal('list(store.item)', {
        description: 'String representing the object’s type.'
      }),
      items: v.array(v1StoreItemPresenter.schema, {
        description: 'Resulting store items.'
      })
    })
  )
  .build();
