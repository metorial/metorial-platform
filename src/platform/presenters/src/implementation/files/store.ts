import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { storeType } from '../../types';

export let v1StorePresenter = Presenter.create(storeType)
  .presenter(async ({ store }) => ({
    object: 'store',
    id: store.id,
    name: store.name,
    access: store.access,
    item_count: store.itemCount,
    created_at: store.createdAt,
    updated_at: store.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('store', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      name: v.string({ description: 'Display name.' }),
      access: v.enumOf(['private', 'public_read', 'public_write'], {
        description:
          'Who else can access the store: `private`, `public_read`, or `public_write`.'
      }),
      item_count: v.number({ description: 'Number of items in the store.' }),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();
