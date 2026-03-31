import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceConsumersGetOutput = {
  object: 'consumer';
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceConsumersGetOutput =
  mtMap.object<ManagementInstanceConsumersGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

