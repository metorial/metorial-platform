import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceNetworksGetOutput = {
  object: 'network';
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceNetworksGetOutput =
  mtMap.object<ManagementInstanceNetworksGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

