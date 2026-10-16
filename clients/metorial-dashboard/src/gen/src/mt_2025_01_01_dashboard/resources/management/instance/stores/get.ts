import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceStoresGetOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceStoresGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceStoresGetOutput>(
    ['item_count', 'created_at', 'updated_at'],
    1
  );
