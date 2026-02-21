import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerAuthImportType } from '../../types';

export let v1ProviderAuthImportPresenter = Presenter.create(providerAuthImportType)
  .presenter(async ({ authImport }) => ({
    object: 'provider.auth_import' as const,
    id: authImport.id,
    note: authImport.note,
    metadata: authImport.metadata,
    provider_id: authImport.providerId,
    provider_deployment_id: authImport.providerDeploymentId ?? authImport.deploymentId,
    provider_auth_config_id: authImport.providerAuthConfigId ?? authImport.authConfigId,
    provider_auth_method_id: authImport.providerAuthMethodId ?? authImport.authMethodId,
    created_at: authImport.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_import', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique auth import identifier',
        examples: ['paci_1vWxYzAbCdEfGhJk']
      }),
      note: v.string({
        name: 'note',
        description: 'Note explaining the import',
        examples: ['Imported from previous environment']
      }),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ imported_from: 'legacy-system', migration_date: '2025-09-01' }]
        })
      ),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Provider ID',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      provider_deployment_id: v.nullable(
        v.string({
          name: 'provider_deployment_id',
          description: 'Deployment ID',
          examples: ['pde_1aBcDeFgHjKlMnPq']
        })
      ),
      provider_auth_config_id: v.nullable(
        v.string({
          name: 'provider_auth_config_id',
          description: 'Auth config ID',
          examples: ['pac_8pQrStUvWxYzAbCd']
        })
      ),
      provider_auth_method_id: v.nullable(
        v.string({
          name: 'provider_auth_method_id',
          description: 'Auth method ID',
          examples: ['pam_2mNpQrStUvWxYzAb']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
