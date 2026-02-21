import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionTemplatesUpdateOutput = {
  object: 'session.template';
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSessionTemplatesUpdateOutput =
  mtMap.object<ManagementInstanceSessionTemplatesUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceSessionTemplatesUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapManagementInstanceSessionTemplatesUpdateBody =
  mtMap.object<ManagementInstanceSessionTemplatesUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

