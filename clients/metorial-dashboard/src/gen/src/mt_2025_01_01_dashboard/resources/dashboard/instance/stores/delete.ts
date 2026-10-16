import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceStoresDeleteOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceStoresDeleteOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceStoresDeleteOutput>(
    ['item_count', 'created_at', 'updated_at'],
    1
  );
