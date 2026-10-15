import { mapObject } from '@metorial/util-resource-mapper/compact';

export type StoresDeleteOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapStoresDeleteOutput =
  /* @__PURE__ */ mapObject<StoresDeleteOutput>(
    ['item_count', 'created_at', 'updated_at'],
    1
  );
