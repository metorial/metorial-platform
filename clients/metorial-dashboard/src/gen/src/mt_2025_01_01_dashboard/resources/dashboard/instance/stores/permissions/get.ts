import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceStoresPermissionsGetOutput = {
  object: 'store.permissions';
  storeId: string;
  hasFullAccess: boolean;
  permissions: ('content_read' | 'content_write')[];
  relevantStoreIds: string[];
  readableStoreIds: string[];
  writableStoreIds: string[];
};

export let mapDashboardInstanceStoresPermissionsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceStoresPermissionsGetOutput>([
    'store_id',
    'has_full_access',
    'relevant_store_ids',
    'readable_store_ids',
    'writable_store_ids'
  ]);
