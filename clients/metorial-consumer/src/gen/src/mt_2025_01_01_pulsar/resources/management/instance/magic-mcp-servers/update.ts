import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceMagicMcpServersUpdateOutput = {
  object: 'magic_mcp.server';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  endpoints: {
    id: string;
    alias: string;
    urls: { sse: string; streamableHttp: string };
  }[];
  serverDeployments: {
    object: 'server.server_deployment#preview';
    id: string;
    name: string | null;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public' | 'custom';
      createdAt: Date;
      updatedAt: Date;
    };
  }[];
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceMagicMcpServersUpdateOutput =
  mtMap.object<ManagementInstanceMagicMcpServersUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    endpoints: mtMap.objectField(
      'endpoints',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          alias: mtMap.objectField('alias', mtMap.passthrough()),
          urls: mtMap.objectField(
            'urls',
            mtMap.object({
              sse: mtMap.objectField('sse', mtMap.passthrough()),
              streamableHttp: mtMap.objectField(
                'streamable_http',
                mtMap.passthrough()
              )
            })
          )
        })
      )
    ),
    serverDeployments: mtMap.objectField(
      'server_deployments',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          server: mtMap.objectField(
            'server',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              type: mtMap.objectField('type', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          )
        })
      )
    ),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceMagicMcpServersUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  aliases?: string[] | undefined;
};

export let mapManagementInstanceMagicMcpServersUpdateBody =
  mtMap.object<ManagementInstanceMagicMcpServersUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    aliases: mtMap.objectField('aliases', mtMap.array(mtMap.passthrough()))
  });

