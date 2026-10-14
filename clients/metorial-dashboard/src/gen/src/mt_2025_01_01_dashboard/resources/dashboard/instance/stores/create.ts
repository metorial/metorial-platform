import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceStoresCreateOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceStoresCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceStoresCreateOutput>(
    ['item_count', 'created_at', 'updated_at'],
    1
  );

export type DashboardInstanceStoresCreateBody = {
  name: string;
  access?: 'private' | 'public_read' | 'public_write' | undefined;
  templateId?: string | undefined;
  parentId?: string | undefined;
};

export let mapDashboardInstanceStoresCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceStoresCreateBody>([
    'template_id',
    'parent_id'
  ]);
