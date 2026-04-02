import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceMagicMcpServersCreateOutput = {
  object: 'magic_mcp.server';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  sessionTemplateId: string;
  providerTemplateId: string | null;
  endpoints: { id: string; alias: string; url: string }[];
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceMagicMcpServersCreateOutput =
  mtMap.object<ManagementInstanceMagicMcpServersCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    sessionTemplateId: mtMap.objectField(
      'session_template_id',
      mtMap.passthrough()
    ),
    providerTemplateId: mtMap.objectField(
      'provider_template_id',
      mtMap.passthrough()
    ),
    endpoints: mtMap.objectField(
      'endpoints',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          alias: mtMap.objectField('alias', mtMap.passthrough()),
          url: mtMap.objectField('url', mtMap.passthrough())
        })
      )
    ),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceMagicMcpServersCreateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  consumerProfileId?: string | undefined;
};

export let mapManagementInstanceMagicMcpServersCreateBody =
  mtMap.object<ManagementInstanceMagicMcpServersCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    consumerProfileId: mtMap.objectField(
      'consumer_profile_id',
      mtMap.passthrough()
    )
  });

