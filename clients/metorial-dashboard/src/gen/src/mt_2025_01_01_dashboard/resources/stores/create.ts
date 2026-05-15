import { mtMap } from '@metorial/util-resource-mapper';

export type StoresCreateOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapStoresCreateOutput = mtMap.object<StoresCreateOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  access: mtMap.objectField('access', mtMap.passthrough()),
  itemCount: mtMap.objectField('item_count', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});

export type StoresCreateBody = {
  name: string;
  access?: 'private' | 'public_read' | 'public_write' | undefined;
  templateId?: string | undefined;
  parentId?: string | undefined;
};

export let mapStoresCreateBody = mtMap.object<StoresCreateBody>({
  name: mtMap.objectField('name', mtMap.passthrough()),
  access: mtMap.objectField('access', mtMap.passthrough()),
  templateId: mtMap.objectField('template_id', mtMap.passthrough()),
  parentId: mtMap.objectField('parent_id', mtMap.passthrough())
});

