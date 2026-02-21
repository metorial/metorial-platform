import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerAuthExportType } from '../../types';
import { v1ProviderAuthConfigPresenter } from './authConfig';

export let v1ProviderAuthExportPresenter = Presenter.create(providerAuthExportType)
  .presenter(async ({ authExport }, opts) => ({
    object: 'provider.auth_export' as const,

    id: authExport.id,
    note: authExport.note,
    ip: authExport.ip,
    user_agent: authExport.userAgent,
    metadata: authExport.metadata,

    auth_config: await v1ProviderAuthConfigPresenter
      .present({ authConfig: authExport.authConfig }, opts)
      .run(),

    provider_id: authExport.providerId,
    provider_deployment_id: authExport.providerDeploymentId,
    auth_method_id: authExport.authMethodId,
    credentials_id: authExport.credentialsId,

    created_at: authExport.createdAt,
    expires_at: authExport.expiresAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_export', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique auth export identifier',
        examples: ['pace_7yZaBcDeFgHjKlMn']
      }),
      note: v.string({
        name: 'note',
        description: 'Note explaining the export reason',
        examples: ['Exported for backup purposes']
      }),
      ip: v.nullable(
        v.string({
          name: 'ip',
          description: 'IP address of the export request',
          examples: ['192.168.1.1']
        })
      ),
      user_agent: v.nullable(
        v.string({
          name: 'user_agent',
          description: 'User agent of the export request'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ exported_by: 'admin@company.com', reason: 'backup' }]
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
          description: 'Timestamp when the export expires',
          examples: [new Date('2026-03-15T10:30:00Z')]
        })
      )
    })
  )
  .build();
