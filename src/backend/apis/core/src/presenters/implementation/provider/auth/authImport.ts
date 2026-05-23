import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { providerAuthImportType } from '../../../types';
import { v1ProviderAuthConfigPresenter } from './authConfig';

export let v1ProviderAuthImportPresenter = Presenter.create(providerAuthImportType)
  .presenter(async ({ authImport }, opts) => ({
    object: 'provider.auth_import' as const,

    id: authImport.id,
    note: authImport.note,
    ip: authImport.ip,
    user_agent: authImport.userAgent,
    metadata: authImport.metadata,

    auth_config: await v1ProviderAuthConfigPresenter
      .present({ authConfig: authImport.authConfig }, opts)
      .run(),

    provider_id: authImport.providerId,
    provider_deployment_id: authImport.providerDeploymentId,
    auth_method_id: authImport.authMethodId,
    credentials_id: authImport.credentialsId,

    created_at: authImport.createdAt,
    expires_at: authImport.expiresAt
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
      ip: v.nullable(
        v.string({
          name: 'ip',
          description: 'IP address of the import request',
          examples: ['192.168.1.1']
        })
      ),
      user_agent: v.nullable(
        v.string({
          name: 'user_agent',
          description: 'User agent of the import request'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ imported_from: 'legacy-system', migration_date: '2025-09-01' }]
        })
      ),
      auth_config: v1ProviderAuthConfigPresenter.schema,
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      provider_deployment_id: v.nullable(
        v.string({
          name: 'provider_deployment_id',
          description: 'Deployment ID',
          examples: ['pde_1aBcDeFgHjKlMnPq']
        })
      ),
      auth_method_id: v.string({
        name: 'auth_method_id',
        description: 'Auth method ID',
        examples: ['pam_2mNpQrStUvWxYzAb']
      }),
      credentials_id: v.nullable(
        v.string({
          name: 'credentials_id',
          description: 'Auth credentials ID',
          examples: ['par_4sTuVwXyZaBcDeFg']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      expires_at: v.nullable(
        v.date({
          name: 'expires_at',
          description: 'Timestamp when the import expires',
          examples: [new Date('2026-03-15T10:30:00Z')]
        })
      )
    })
  )
  .build();
