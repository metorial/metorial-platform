import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type StoresUpdateOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapStoresUpdateOutput =
  /* @__PURE__ */ mapObject<StoresUpdateOutput>(
    ['item_count', 'created_at', 'updated_at'],
    1
  );

export type StoresUpdateBody = {
  name?: string | undefined;
  access?: 'private' | 'public_read' | 'public_write' | undefined;
};

export let mapStoresUpdateBody =
  /* @__PURE__ */ createMapper<StoresUpdateBody>(0);
