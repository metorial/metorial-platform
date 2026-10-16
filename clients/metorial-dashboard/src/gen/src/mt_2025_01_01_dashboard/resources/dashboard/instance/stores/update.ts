import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceStoresUpdateOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceStoresUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceStoresUpdateOutput>(
    ['item_count', 'created_at', 'updated_at'],
    1
  );

export type DashboardInstanceStoresUpdateBody = {
  name?: string | undefined;
  access?: 'private' | 'public_read' | 'public_write' | undefined;
};

export let mapDashboardInstanceStoresUpdateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceStoresUpdateBody>(0);
