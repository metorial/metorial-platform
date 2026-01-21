import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { authExportType } from '../types';

export let v1AuthExportPresenter = Presenter.create(authExportType)
  .presenter(async ({ authExport }) => ({
    object: 'provider.auth_export' as const,
    id: authExport.id,
    note: authExport.note,
    metadata: authExport.metadata,
    provider_auth_config_id: authExport.providerAuthConfigId ?? authExport.authConfigId,
    created_at: authExport.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_export'),
      id: v.string({ name: 'id', description: 'Unique auth export identifier', examples: ['exp_abc123def456'] }),
      note: v.string({ name: 'note', description: 'Note explaining the export reason', examples: ['Exported for backup purposes'] }),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom metadata', examples: [{ purpose: 'migration' }] })),
      provider_auth_config_id: v.string({
        name: 'provider_auth_config_id',
        description: 'Auth config ID that was exported',
        examples: ['acfg_abc123def456']
      }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] })
    })
  )
  .build();

// Presenter for export with decrypted value (returned on create)
export let v1AuthExportWithValuePresenter = Presenter.create(authExportType)
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
      object: v.literal('provider.auth_export'),
      id: v.string({ name: 'id', description: 'Unique auth export identifier', examples: ['exp_abc123def456'] }),
      note: v.string({ name: 'note', description: 'Note explaining the export reason', examples: ['Exported for backup purposes'] }),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom metadata', examples: [{ purpose: 'migration' }] })),
      provider_auth_config_id: v.string({
        name: 'provider_auth_config_id',
        description: 'Auth config ID that was exported',
        examples: ['acfg_abc123def456']
      }),
      value: v.record(v.any(), { name: 'value', description: 'Decrypted auth config data', examples: [{ access_token: 'gho_xxxx...', refresh_token: 'ghr_xxxx...' }] }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] })
    })
  )
  .build();
