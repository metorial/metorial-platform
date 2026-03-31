import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceConsumersCreateOutput = {
  object: 'consumer';
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceConsumersCreateOutput =
  mtMap.object<ManagementInstanceConsumersCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceConsumersCreateBody = {
  name: string;
  email: string;
};

export let mapManagementInstanceConsumersCreateBody =
  mtMap.object<ManagementInstanceConsumersCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough())
  });

