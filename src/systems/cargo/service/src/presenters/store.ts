import type { Store } from '@metorial-cargo/db';

export let storePresenter = (store: Store) => ({
  object: 'cargo#store',
  id: store.id,
  name: store.name,
  access: store.access,
  cloneType: store.cloneType ?? undefined,
  itemCount: store.itemCount,
  isReadOnly: store.isReadOnly,
  isTemplateBacking: store.isTemplateBacking,
  createdAt: store.createdAt,
  updatedAt: store.updatedAt
});
