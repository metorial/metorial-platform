import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionTemplatesGetOutput = {
  object: 'session.template';
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSessionTemplatesGetOutput =
  mtMap.object<ManagementInstanceSessionTemplatesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });
