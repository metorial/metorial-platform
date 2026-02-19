import { mtMap } from '@metorial/util-resource-mapper';

export type SessionTemplatesProvidersUpdateOutput = {
  object: 'session.template.provider';
  id: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  sessionTemplateId: string;
  providerId: string;
  providerDeploymentId: string | null;
  providerDeploymentName: string | null;
  providerConfigName: string | null;
  providerAuthConfigName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapSessionTemplatesProvidersUpdateOutput =
  mtMap.object<SessionTemplatesProvidersUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    sessionTemplateId: mtMap.objectField('session_template_id', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField('provider_deployment_id', mtMap.passthrough()),
    providerDeploymentName: mtMap.objectField('provider_deployment_name', mtMap.passthrough()),
    providerConfigName: mtMap.objectField('provider_config_name', mtMap.passthrough()),
    providerAuthConfigName: mtMap.objectField(
      'provider_auth_config_name',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type SessionTemplatesProvidersUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  providerDeployment?:
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
    | string
    | undefined;
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
};

export let mapSessionTemplatesProvidersUpdateBody =
  mtMap.object<SessionTemplatesProvidersUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
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
            providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
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
            providerConfigId: mtMap.objectField('provider_config_id', mtMap.passthrough()),
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
            credentials: mtMap.objectField('credentials', mtMap.passthrough())
          })
        ),
        mtMap.unionOption('string', mtMap.passthrough())
      ])
    ),
    toolFilters: mtMap.objectField(
      'tool_filters',
      mtMap.object({
        toolKeys: mtMap.objectField('tool_keys', mtMap.array(mtMap.passthrough()))
      })
    )
  });
