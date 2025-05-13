import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementUserUpdateOutput = {
  id: string;
  status: 'active' | 'deleted';
  type: 'user';
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementUserUpdateOutput =
  mtMap.object<ManagementUserUpdateOutput>({
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    firstName: mtMap.objectField('first_name', mtMap.passthrough()),
    lastName: mtMap.objectField('last_name', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementUserUpdateBody = {
  name?: string | undefined;
  email?: string | undefined;
};

export let mapManagementUserUpdateBody = mtMap.object<ManagementUserUpdateBody>(
  {
    name: mtMap.objectField('name', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough())
  }
);

