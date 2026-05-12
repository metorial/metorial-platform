import type {
  DashboardInstanceStoresCreateBody,
  DashboardInstanceStoresGetOutput,
  DashboardInstanceStoresItemsGetOutput,
  DashboardInstanceStoresItemsListQuery,
  DashboardInstanceStoresItemsModifyBody,
  DashboardInstanceStoresListQuery,
  DashboardInstanceStoresUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type Store = DashboardInstanceStoresGetOutput;
export type StoreItem = DashboardInstanceStoresItemsGetOutput;

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeStoreItemsListQuery = (
  query: DashboardInstanceStoresItemsListQuery
): DashboardInstanceStoresItemsListQuery => ({
  ...query,
  type: toArrayIfString(query.type)
});

export let storesLoader = createLoader({
  name: 'stores',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceStoresListQuery) =>
    withAuth(sdk => sdk.stores.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateStore = storesLoader.createExternalMutator(
  (i: DashboardInstanceStoresCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.stores.create(i.instanceId, i))
);

export let useStores = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceStoresListQuery | null
) => {
  return usePaginator(
    pagination =>
      storesLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ?? null
  );
};

export let storeLoader = createLoader({
  name: 'store',
  parents: [storesLoader],
  fetch: (i: { instanceId: string; storeId: string }) =>
    withAuth(sdk => sdk.stores.get(i.instanceId, i.storeId)),
  mutators: {
    update: (
      i: DashboardInstanceStoresUpdateBody,
      { input: { instanceId, storeId } }: { input: { instanceId: string; storeId: string } }
    ) => withAuth(sdk => sdk.stores.update(instanceId, storeId, i)),

    delete: (
      _: void,
      { input: { instanceId, storeId } }: { input: { instanceId: string; storeId: string } }
    ) => withAuth(sdk => sdk.stores.delete(instanceId, storeId))
  }
});

export let useStore = (
  instanceId: string | null | undefined,
  storeId: string | null | undefined
) => {
  let data = storeLoader.use(instanceId && storeId ? { instanceId, storeId } : null);

  return {
    ...data,
    updateMutator: data.useMutator('update'),
    deleteMutator: data.useMutator('delete')
  };
};

export let storeItemsLoader = createLoader({
  name: 'storeItems',
  parents: [storeLoader, storesLoader],
  fetch: (
    i: { instanceId: string; storeId: string } & DashboardInstanceStoresItemsListQuery
  ) =>
    withAuth(sdk =>
      sdk.stores.items.list(i.instanceId, i.storeId, normalizeStoreItemsListQuery(i))
    ),
  mutators: {}
});

export let useModifyStoreItems = storeItemsLoader.createExternalMutator(
  (i: DashboardInstanceStoresItemsModifyBody & { instanceId: string; storeId: string }) =>
    withAuth(sdk => sdk.stores.items.modify(i.instanceId, i.storeId, i))
);

export let useStoreItems = (
  instanceId: string | null | undefined,
  storeId: string | null | undefined,
  query?: DashboardInstanceStoresItemsListQuery | null
) => {
  return usePaginator(
    pagination =>
      storeItemsLoader.use(
        instanceId && storeId && query !== null
          ? { instanceId, storeId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && storeId ? `${instanceId}:${storeId}` : null
  );
};

export let allStoreItemsLoader = createLoader({
  name: 'allStoreItems',
  parents: [storeLoader, storeItemsLoader],
  fetch: (
    i: {
      instanceId: string;
      storeId: string;
    } & Omit<DashboardInstanceStoresItemsListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.stores.items.list(
          i.instanceId,
          i.storeId,
          normalizeStoreItemsListQuery({
            ...i,
            ...cursor,
            limit: i.limit ?? 100,
            order: i.order ?? 'asc'
          })
        )
      )
    ),
  mutators: {}
});

export let useAllStoreItems = (
  instanceId: string | null | undefined,
  storeId: string | null | undefined,
  query?: Omit<DashboardInstanceStoresItemsListQuery, 'after' | 'before' | 'cursor'> | null
) => {
  return allStoreItemsLoader.use(
    instanceId && storeId && query !== null
      ? {
          instanceId,
          storeId,
          ...(query ?? {})
        }
      : null
  );
};

export let storeItemLoader = createLoader({
  name: 'storeItem',
  parents: [storeItemsLoader, storeLoader],
  fetch: (i: { instanceId: string; storeId: string; itemId: string }) =>
    withAuth(sdk => sdk.stores.items.get(i.instanceId, i.storeId, i.itemId)),
  mutators: {}
});

export let useStoreItem = (
  instanceId: string | null | undefined,
  storeId: string | null | undefined,
  itemId: string | null | undefined
) => {
  return storeItemLoader.use(
    instanceId && storeId && itemId ? { instanceId, storeId, itemId } : null
  );
};
