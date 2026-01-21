import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { authImportType } from '../types';

export let v1AuthImportPresenter = Presenter.create(authImportType)
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
      object: v.literal('provider.auth_import'),
      id: v.string({ name: 'id', description: 'Unique auth import identifier', examples: ['imp_abc123def456'] }),
      note: v.string({ name: 'note', description: 'Note explaining the import', examples: ['Imported from previous environment'] }),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom metadata', examples: [{ source: 'staging' }] })),
      provider_id: v.nullable(v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pvd_abc123def456'] })),
      provider_deployment_id: v.nullable(
        v.string({ name: 'provider_deployment_id', description: 'Deployment ID', examples: ['dep_abc123def456'] })
      ),
      provider_auth_config_id: v.nullable(
        v.string({ name: 'provider_auth_config_id', description: 'Auth config ID', examples: ['acfg_abc123def456'] })
      ),
      provider_auth_method_id: v.nullable(
        v.string({ name: 'provider_auth_method_id', description: 'Auth method ID', examples: ['auth_abc123def456'] })
      ),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] })
    })
  )
  .build();
