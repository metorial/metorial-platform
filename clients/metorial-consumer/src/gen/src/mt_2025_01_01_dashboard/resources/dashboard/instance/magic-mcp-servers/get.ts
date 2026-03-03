import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceMagicMcpServersGetOutput = {
  object: 'magic_mcp.server';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  sessionTemplateId: string;
  endpoints: { id: string; alias: string; url: string }[];
  name: string | null;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceMagicMcpServersGetOutput =
  mtMap.object<DashboardInstanceMagicMcpServersGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    sessionTemplateId: mtMap.objectField(
      'session_template_id',
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

