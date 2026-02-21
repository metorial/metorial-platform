import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderDeploymentsCreateOutput = {
  object: 'provider.deployment';
  id: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  providerId: string;
  provider: {
    object: 'provider#preview';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  lockedVersion: {
    object: 'provider.version';
    id: string;
    version: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  defaultConfig: {
    id: string;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderDeploymentsCreateOutput =
  mtMap.object<ManagementInstanceProviderDeploymentsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    provider: mtMap.objectField(
      'provider',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    lockedVersion: mtMap.objectField(
      'locked_version',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        version: mtMap.objectField('version', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    defaultConfig: mtMap.objectField(
      'default_config',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceProviderDeploymentsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  providerId: string;
  lockedProviderVersionId?: string | undefined;
  config?:
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
};

export let mapManagementInstanceProviderDeploymentsCreateBody =
  mtMap.object<ManagementInstanceProviderDeploymentsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
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
        ),
        mtMap.unionOption('string', mtMap.passthrough())
      ])
    )
  });

