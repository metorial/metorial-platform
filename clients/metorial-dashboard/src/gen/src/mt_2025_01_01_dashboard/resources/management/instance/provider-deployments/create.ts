import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderDeploymentsCreateOutput = {
  object: 'provider.deployment';
  id: string;
  isDefault: boolean;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  providerId: string;
  lockedVersion: {
    object: 'provider.version';
    id: string;
    version: string;
    providerId: string;
    isCurrent: boolean;
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    specificationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  defaultConfig: {
    object: 'provider.config#preview';
    id: string;
    isDefault: boolean;
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
    isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    lockedVersion: mtMap.objectField(
      'locked_version',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        version: mtMap.objectField('version', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        isCurrent: mtMap.objectField('is_current', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        specificationId: mtMap.objectField(
          'specification_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    defaultConfig: mtMap.objectField(
      'default_config',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
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
} & (
  | { providerConfigId?: string | undefined }
  | {
      providerConfig?:
        | { name?: string | undefined; value: Record<string, any> }
        | { name?: string | undefined; providerConfigVaultId: string }
        | undefined;
    }
);

export let mapManagementInstanceProviderDeploymentsCreateBody = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
      lockedProviderVersionId: mtMap.objectField(
        'locked_provider_version_id',
        mtMap.passthrough()
      ),
      providerConfigId: mtMap.objectField(
        'provider_config_id',
        mtMap.passthrough()
      ),
      providerConfig: mtMap.objectField(
        'provider_config',
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              name: mtMap.objectField('name', mtMap.passthrough()),
              value: mtMap.objectField('value', mtMap.passthrough()),
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
]);

