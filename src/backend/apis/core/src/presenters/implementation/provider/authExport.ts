import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { authExportType } from '../../types';

export let v1AuthExportPresenter = Presenter.create(authExportType)
  .presenter(async ({ authExport }) => ({
    object: 'provider.auth_export' as const,
    id: authExport.id,
    note: authExport.note,
    metadata: authExport.metadata,
    provider_auth_config_id: authExport.providerAuthConfigId ?? authExport.authConfigId,
    value: authExport.value,
    created_at: authExport.createdAt
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
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ exported_by: 'admin@company.com', reason: 'backup' }]
        })
      ),
      provider_auth_config_id: v.string({
        name: 'provider_auth_config_id',
        description: 'Auth config ID that was exported',
        examples: ['pac_8pQrStUvWxYzAbCd']
      }),
      value: v.record(v.any(), {
        name: 'value',
        description: 'The exported credential data (access token, refresh token, etc.)',
        examples: [
          {
            access_token: 'gho_xxxxxxxxxxxxxxxxxxxx',
            refresh_token: 'ghr_xxxxxxxxxxxxxxxxxxxx',
            token_type: 'bearer',
            scope: 'repo,read:user'
          }
        ]
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
