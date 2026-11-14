import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let storeAuditResource = resource({
  name: 'store',
  payload: v.typedAny<{
    id: string;
    name: string;
    access: string;
    itemCount: number;
    byteSize: number | null;
    isReadOnly: boolean;
    cloneType: string | null;
  }>('store'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export type StoreItemOperationSummary = {
  type: 'add' | 'modify' | 'remove';
  kind: string;
  path: string;
  previousPath?: string;
  itemId?: string;
  fileId?: string;
  documentId?: string;
};

export let storeItemsAuditResource = resource({
  name: 'store_items',
  payload: v.typedAny<{
    storeId: string;
    storeName: string;
    skillId: string | null;
    counts: {
      add: number;
      modify: number;
      remove: number;
    };
    operations: StoreItemOperationSummary[];
    truncated: boolean;
  }>('store_items'),
  presenter: undefined,
  actions: {
    modify: true
  }
});
