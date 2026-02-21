import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionsCreateOutput = {
  object: 'session';
  id: string;
  name: string | null;
  description: string | null;
  status: 'active' | 'deleted';
  connectionStatus: 'connected' | 'disconnected';
  usage: {
    totalProductiveMessageCount: number;
    totalProductiveClientMessageCount: number;
    totalProductiveServerMessageCount: number;
  };
  metadata: Record<string, any> | null;
  connectionUrl: string | null;
  connectionKey: string | null;
  providerDeployments: {
    object: 'session.provider_deployment#preview';
    id: string;
    name: string | null;
    providerId: string;
    providerDeploymentId: string | null;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSessionsCreateOutput =
  mtMap.object<DashboardInstanceSessionsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    connectionStatus: mtMap.objectField(
      'connection_status',
      mtMap.passthrough()
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
    connectionUrl: mtMap.objectField('connection_url', mtMap.passthrough()),
    connectionKey: mtMap.objectField('connection_key', mtMap.passthrough()),
    providerDeployments: mtMap.objectField(
      'provider_deployments',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          providerDeploymentId: mtMap.objectField(
            'provider_deployment_id',
            mtMap.passthrough()
          )
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceSessionsCreateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  providers: {
    providerDeployment:
      | { type: 'reference'; providerDeploymentId: string }
      | {
          type: 'new';
          providerId: string;
          name?: string | undefined;
          description?: string | undefined;
          metadata?: Record<string, any> | undefined;
          lockedProviderVersionId?: string | undefined;
          config?:
            | { type: 'none' }
            | { type: 'reference'; providerConfigId: string }
            | {
                type: 'new';
                name?: string | undefined;
                config:
                  | { type: 'new'; data: Record<string, any> }
                  | { type: 'vault'; providerConfigVaultId: string };
              }
            | undefined;
        }
      | string;
    providerConfig?:
      | { type: 'reference'; providerConfigId: string }
      | {
          type: 'new';
          name?: string | undefined;
          config:
            | { type: 'new'; data: Record<string, any> }
            | { type: 'vault'; providerConfigVaultId: string };
        }
      | string
      | undefined;
    providerAuthConfig?:
      | { type: 'reference'; providerAuthConfigId: string }
      | {
          type: 'new';
          name?: string | undefined;
          providerAuthMethodId: string;
          credentials: Record<string, any>;
        }
      | string
      | undefined;
    sessionTemplateId?: string | undefined;
    toolFilters?: { toolKeys?: string[] | undefined } | undefined;
  }[];
};

export let mapDashboardInstanceSessionsCreateBody =
  mtMap.object<DashboardInstanceSessionsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providers: mtMap.objectField(
      'providers',
      mtMap.array(
        mtMap.object({
          providerDeployment: mtMap.objectField(
            'provider_deployment',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  providerDeploymentId: mtMap.objectField(
                    'provider_deployment_id',
                    mtMap.passthrough()
                  ),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
                  lockedProviderVersionId: mtMap.objectField(
                    'locked_provider_version_id',
                    mtMap.passthrough()
                  ),
                  config: mtMap.objectField(
                    'config',
                    mtMap.union([
                      mtMap.unionOption(
                        'object',
                        mtMap.object({
                          type: mtMap.objectField('type', mtMap.passthrough()),
                          providerConfigId: mtMap.objectField(
                            'provider_config_id',
                            mtMap.passthrough()
                          ),
                          name: mtMap.objectField('name', mtMap.passthrough()),
                          config: mtMap.objectField(
                            'config',
                            mtMap.union([
                              mtMap.unionOption(
                                'object',
                                mtMap.object({
                                  type: mtMap.objectField(
                                    'type',
                                    mtMap.passthrough()
                                  ),
                                  data: mtMap.objectField(
                                    'data',
                                    mtMap.passthrough()
                                  ),
                                  providerConfigVaultId: mtMap.objectField(
                                    'provider_config_vault_id',
                                    mtMap.passthrough()
                                  )
                                })
                              )
                            ])
                          )
                        })
                      )
                    ])
                  )
                })
              ),
              mtMap.unionOption('string', mtMap.passthrough())
            ])
          ),
          providerConfig: mtMap.objectField(
            'provider_config',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  providerConfigId: mtMap.objectField(
                    'provider_config_id',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  config: mtMap.objectField(
                    'config',
                    mtMap.union([
                      mtMap.unionOption(
                        'object',
                        mtMap.object({
                          type: mtMap.objectField('type', mtMap.passthrough()),
                          data: mtMap.objectField('data', mtMap.passthrough()),
                          providerConfigVaultId: mtMap.objectField(
                            'provider_config_vault_id',
                            mtMap.passthrough()
                          )
                        })
                      )
                    ])
                  )
                })
              ),
              mtMap.unionOption('string', mtMap.passthrough())
            ])
          ),
          providerAuthConfig: mtMap.objectField(
            'provider_auth_config',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  providerAuthConfigId: mtMap.objectField(
                    'provider_auth_config_id',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  providerAuthMethodId: mtMap.objectField(
                    'provider_auth_method_id',
                    mtMap.passthrough()
                  ),
                  credentials: mtMap.objectField(
                    'credentials',
                    mtMap.passthrough()
                  )
                })
              ),
              mtMap.unionOption('string', mtMap.passthrough())
            ])
          ),
          sessionTemplateId: mtMap.objectField(
            'session_template_id',
            mtMap.passthrough()
          ),
          toolFilters: mtMap.objectField(
            'tool_filters',
            mtMap.object({
              toolKeys: mtMap.objectField(
                'tool_keys',
                mtMap.array(mtMap.passthrough())
              )
            })
          )
        })
      )
    )
  });

