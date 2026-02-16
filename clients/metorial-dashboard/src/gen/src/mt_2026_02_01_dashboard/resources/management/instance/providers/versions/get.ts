import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProvidersVersionsGetOutput = {
  object: 'provider.version';
  id: string;
  version: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProvidersVersionsGetOutput =
  mtMap.object<ManagementInstanceProvidersVersionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    version: mtMap.objectField('version', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

