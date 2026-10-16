import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceStoresUpdateOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceStoresUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceStoresUpdateOutput>(
    ['item_count', 'created_at', 'updated_at'],
    1
  );

export type ManagementInstanceStoresUpdateBody = {
  name?: string | undefined;
  access?: 'private' | 'public_read' | 'public_write' | undefined;
};

export let mapManagementInstanceStoresUpdateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceStoresUpdateBody>(0);
