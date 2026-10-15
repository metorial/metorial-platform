import { mapObject } from '@metorial/util-resource-mapper/compact';

export type StoresCreateOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapStoresCreateOutput =
  /* @__PURE__ */ mapObject<StoresCreateOutput>(
    ['item_count', 'created_at', 'updated_at'],
    1
  );

export type StoresCreateBody = {
  name: string;
  access?: 'private' | 'public_read' | 'public_write' | undefined;
  templateId?: string | undefined;
  parentId?: string | undefined;
};

export let mapStoresCreateBody = /* @__PURE__ */ mapObject<StoresCreateBody>([
  'template_id',
  'parent_id'
]);
