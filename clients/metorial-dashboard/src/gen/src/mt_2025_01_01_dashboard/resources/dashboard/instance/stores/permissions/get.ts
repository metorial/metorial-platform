import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardInstanceStoresPermissionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    storeId: mtMap.objectField('store_id', mtMap.passthrough()),
    hasFullAccess: mtMap.objectField('has_full_access', mtMap.passthrough()),
    permissions: mtMap.objectField(
      'permissions',
      mtMap.array(mtMap.passthrough())
    ),
    relevantStoreIds: mtMap.objectField(
      'relevant_store_ids',
      mtMap.array(mtMap.passthrough())
    ),
    readableStoreIds: mtMap.objectField(
      'readable_store_ids',
      mtMap.array(mtMap.passthrough())
    ),
    writableStoreIds: mtMap.objectField(
      'writable_store_ids',
      mtMap.array(mtMap.passthrough())
    )
  });

