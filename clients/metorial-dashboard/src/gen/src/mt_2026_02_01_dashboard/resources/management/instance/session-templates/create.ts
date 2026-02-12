import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionTemplatesCreateOutput = {
  object: 'session.template';
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSessionTemplatesCreateOutput =
  mtMap.object<ManagementInstanceSessionTemplatesCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceSessionTemplatesCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  providers?:
    | {
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
        toolFilters?: { toolKeys?: string[] | undefined } | undefined;
      }[]
    | undefined;
};

export let mapManagementInstanceSessionTemplatesCreateBody =
  mtMap.object<ManagementInstanceSessionTemplatesCreateBody>({
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

