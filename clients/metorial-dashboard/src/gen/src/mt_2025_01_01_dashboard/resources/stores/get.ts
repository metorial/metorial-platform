import { mapObject } from '@metorial/util-resource-mapper/compact';

export type StoresGetOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapStoresGetOutput = /* @__PURE__ */ mapObject<StoresGetOutput>(
  ['item_count', 'created_at', 'updated_at'],
  1
);
