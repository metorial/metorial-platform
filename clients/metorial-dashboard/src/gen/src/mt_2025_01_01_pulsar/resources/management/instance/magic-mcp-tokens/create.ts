import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceMagicMcpTokensCreateOutput = {
  object: 'magic_mcp.token';
  id: string;
  status: 'active' | 'deleted';
  secret: string;
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceMagicMcpTokensCreateOutput =
  mtMap.object<ManagementInstanceMagicMcpTokensCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    secret: mtMap.objectField('secret', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceMagicMcpTokensCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapManagementInstanceMagicMcpTokensCreateBody =
  mtMap.object<ManagementInstanceMagicMcpTokensCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

