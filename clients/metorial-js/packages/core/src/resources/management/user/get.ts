import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementUserGetOutput = {
  id: string;
  status: 'active' | 'deleted';
  type: 'user';
  email: string;
  name: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementUserGetOutput = mtMap.object<ManagementUserGetOutput>({
  id: mtMap.objectField('id', mtMap.passthrough()),
  status: mtMap.objectField('status', mtMap.passthrough()),
  type: mtMap.objectField('type', mtMap.passthrough()),
  email: mtMap.objectField('email', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});

