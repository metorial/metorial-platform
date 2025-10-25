import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceServerConfigVaultsUpdateOutput = {
  object: 'server_config_vault';
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  secretId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceServerConfigVaultsUpdateOutput =
  mtMap.object<ManagementInstanceServerConfigVaultsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    secretId: mtMap.objectField('secret_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceServerConfigVaultsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapManagementInstanceServerConfigVaultsUpdateBody =
  mtMap.object<ManagementInstanceServerConfigVaultsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

