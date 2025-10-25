import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceMagicMcpServersCreateOutput = {
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

export let mapDashboardInstanceMagicMcpServersCreateOutput =
  mtMap.object<DashboardInstanceMagicMcpServersCreateOutput>({
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

export type DashboardInstanceMagicMcpServersCreateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  config: Record<string, any>;
  oauthConfig?: { clientId: string; clientSecret: string } | undefined;
  access?:
    | { ipAllowlist: { ipWhitelist: string[]; ipBlacklist: string[] } | null }
    | undefined;
} & (
  | {
      serverImplementation: {
        name?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, any> | undefined;
        getLaunchParams?: string | undefined;
      } & ({ serverId: string } | { serverVariantId: string });
    }
  | { serverImplementationId: string }
  | { serverVariantId: string }
  | { serverId: string }
);

export let mapDashboardInstanceMagicMcpServersCreateBody = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      config: mtMap.objectField('config', mtMap.passthrough()),
      oauthConfig: mtMap.objectField(
        'oauth_config',
        mtMap.object({
          clientId: mtMap.objectField('client_id', mtMap.passthrough()),
          clientSecret: mtMap.objectField('client_secret', mtMap.passthrough())
        })
      ),
      access: mtMap.objectField(
        'access',
        mtMap.object({
          ipAllowlist: mtMap.objectField(
            'ip_allowlist',
            mtMap.object({
              ipWhitelist: mtMap.objectField(
                'ip_whitelist',
                mtMap.array(mtMap.passthrough())
              ),
              ipBlacklist: mtMap.objectField(
                'ip_blacklist',
                mtMap.array(mtMap.passthrough())
              )
            })
          )
        })
      ),
      serverImplementation: mtMap.objectField(
        'server_implementation',
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              getLaunchParams: mtMap.objectField(
                'get_launch_params',
                mtMap.passthrough()
              ),
              serverId: mtMap.objectField('server_id', mtMap.passthrough()),
              serverVariantId: mtMap.objectField(
                'server_variant_id',
                mtMap.passthrough()
              )
            })
          )
        ])
      ),
      serverImplementationId: mtMap.objectField(
        'server_implementation_id',
        mtMap.passthrough()
      ),
      serverVariantId: mtMap.objectField(
        'server_variant_id',
        mtMap.passthrough()
      ),
      serverId: mtMap.objectField('server_id', mtMap.passthrough())
    })
  )
]);

