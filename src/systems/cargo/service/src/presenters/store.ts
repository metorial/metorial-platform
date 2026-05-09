import type { Store } from '../../prisma/generated/client';

export let storePresenter = (store: Store) => ({
  object: 'cargo#store',
  id: store.id,
  name: store.name,
  itemCount: store.itemCount,
  createdAt: store.createdAt,
  updatedAt: store.updatedAt
});
