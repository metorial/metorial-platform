import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsCreateOutput = {
  object: 'session';
  id: string;
  status: 'active' | 'deleted';
  connectionStatus: 'connected' | 'disconnected';
  clientSecret: {
    object: 'client_secret';
    type: 'session';
    id: string;
    secret: string;
    expiresAt: Date;
  };
  serverDeployments: {
    object: 'session.server_deployment#preview';
    id: string;
    name: string | null;
    oauthSessionId: string | null;
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
    connectionUrls: { sse: string; streamableHttp: string };
  }[];
  usage: {
    totalProductiveMessageCount: number;
    totalProductiveClientMessageCount: number;
    totalProductiveServerMessageCount: number;
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSessionsCreateOutput =
  mtMap.object<ManagementInstanceSessionsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    connectionStatus: mtMap.objectField(
      'connection_status',
      mtMap.passthrough()
    ),
    clientSecret: mtMap.objectField(
      'client_secret',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        secret: mtMap.objectField('secret', mtMap.passthrough()),
        expiresAt: mtMap.objectField('expires_at', mtMap.date())
      })
    ),
    serverDeployments: mtMap.objectField(
      'server_deployments',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          oauthSessionId: mtMap.objectField(
            'oauth_session_id',
            mtMap.passthrough()
          ),
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
          ),
          connectionUrls: mtMap.objectField(
            'connection_urls',
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
    usage: mtMap.objectField(
      'usage',
      mtMap.object({
        totalProductiveMessageCount: mtMap.objectField(
          'total_productive_message_count',
          mtMap.passthrough()
        ),
        totalProductiveClientMessageCount: mtMap.objectField(
          'total_productive_client_message_count',
          mtMap.passthrough()
        ),
        totalProductiveServerMessageCount: mtMap.objectField(
          'total_productive_server_message_count',
          mtMap.passthrough()
        )
      })
    ),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceSessionsCreateBody = {
  serverDeployments: (
    | ((({
        name?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, any> | undefined;
        oauthConfig?: { clientId: string; clientSecret: string } | undefined;
        access?:
          | {
              ipAllowlist: {
                ipWhitelist: string[];
                ipBlacklist: string[];
              } | null;
            }
          | undefined;
      } & ({ config: Record<string, any> } | { serverConfigVaultId: string })) &
        (
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
        )) &
        ({ oauthSessionId: string } | { tokenImportId: string } | {}))
    | string
    | ({ serverDeploymentId: string } & (
        | { oauthSessionId: string }
        | { tokenImportId: string }
        | {}
      ))
  )[];
};

export let mapManagementInstanceSessionsCreateBody =
  mtMap.object<ManagementInstanceSessionsCreateBody>({
    serverDeployments: mtMap.objectField(
      'server_deployments',
      mtMap.array(
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
              oauthConfig: mtMap.objectField(
                'oauth_config',
                mtMap.object({
                  clientId: mtMap.objectField('client_id', mtMap.passthrough()),
                  clientSecret: mtMap.objectField(
                    'client_secret',
                    mtMap.passthrough()
                  )
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
              config: mtMap.objectField('config', mtMap.passthrough()),
              serverConfigVaultId: mtMap.objectField(
                'server_config_vault_id',
                mtMap.passthrough()
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
                      metadata: mtMap.objectField(
                        'metadata',
                        mtMap.passthrough()
                      ),
                      getLaunchParams: mtMap.objectField(
                        'get_launch_params',
                        mtMap.passthrough()
                      ),
                      serverId: mtMap.objectField(
                        'server_id',
                        mtMap.passthrough()
                      ),
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
              serverId: mtMap.objectField('server_id', mtMap.passthrough()),
              oauthSessionId: mtMap.objectField(
                'oauth_session_id',
                mtMap.passthrough()
              ),
              tokenImportId: mtMap.objectField(
                'token_import_id',
                mtMap.passthrough()
              ),
              serverDeploymentId: mtMap.objectField(
                'server_deployment_id',
                mtMap.passthrough()
              )
            })
          ),
          mtMap.unionOption('string', mtMap.passthrough())
        ])
      )
    )
  });

