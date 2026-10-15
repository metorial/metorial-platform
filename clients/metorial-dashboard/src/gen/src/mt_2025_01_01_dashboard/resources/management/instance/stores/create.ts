import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceStoresCreateOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceStoresCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceStoresCreateOutput>(
    ['item_count', 'created_at', 'updated_at'],
    1
  );

export type ManagementInstanceStoresCreateBody = {
  name: string;
  access?: 'private' | 'public_read' | 'public_write' | undefined;
  templateId?: string | undefined;
  parentId?: string | undefined;
};

export let mapManagementInstanceStoresCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceStoresCreateBody>([
    'template_id',
    'parent_id'
  ]);
