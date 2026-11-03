import { mapObject } from '@metorial/util-resource-mapper/compact';

export type StoresPermissionsGetOutput = {
  object: 'store.permissions';
  storeId: string;
  canManageAccess: boolean;
  hasFullAccess: boolean;
  permissions: ('content_read' | 'content_write')[];
  relevantStoreIds: string[];
  readableStoreIds: string[];
  writableStoreIds: string[];
};

export let mapStoresPermissionsGetOutput =
  /* @__PURE__ */ mapObject<StoresPermissionsGetOutput>([
    'store_id',
    'can_manage_access',
    'has_full_access',
    'relevant_store_ids',
    'readable_store_ids',
    'writable_store_ids'
  ]);
