import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerRunType } from '../../types';

export let v1ProviderRunPresenter = Presenter.create(providerRunType)
  .presenter(async ({ providerRun }) => ({
    object: 'session.provider_run' as const,
    id: providerRun.id,
    status: providerRun.status,
    name: providerRun.name,
    description: providerRun.description,
    metadata: providerRun.metadata,
    session_id: providerRun.sessionId,
    session_provider_id: providerRun.sessionProviderId,
    provider_id: providerRun.providerId,
    provider_deployment_id: providerRun.providerDeploymentId,
    provider_version_id: providerRun.providerVersionId,
    started_at: providerRun.startedAt,
    completed_at: providerRun.completedAt,
    created_at: providerRun.createdAt,
    updated_at: providerRun.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session.provider_run', { description: "String representing the object's type" }),
      id: v.string({ name: 'id', description: 'Unique provider run identifier', examples: ['prn_8hJkLmNpQrStUvWx'] }),
      status: v.nullable(v.string({ name: 'status', description: 'Run status', examples: ['completed'] })),
      name: v.nullable(v.string({ name: 'name', description: 'Display name', examples: ['Tool execution'] })),
      description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['Executing search_files tool'] })),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom key-value pairs', examples: [{ tool_name: 'search_files' }] })),
      session_id: v.string({ name: 'session_id', description: 'Parent session ID', examples: ['ses_4dEfGhJkLmNpQrSt'] }),
      session_provider_id: v.nullable(v.string({ name: 'session_provider_id', description: 'Session provider ID', examples: ['spr_3cDeFgHjKlMnPqRs'] })),
      provider_id: v.nullable(v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pro_5gHjKlMnPqRsTuVw'] })),
      provider_deployment_id: v.nullable(v.string({ name: 'provider_deployment_id', description: 'Provider deployment ID', examples: ['pde_1aBcDeFgHjKlMnPq'] })),
      provider_version_id: v.nullable(v.string({ name: 'provider_version_id', description: 'Provider version ID', examples: ['prv_4dEfGhJkLmNpQrSt'] })),
      started_at: v.nullable(v.date({ name: 'started_at', description: 'Timestamp when run started', examples: [new Date('2025-09-15T10:30:00Z')] })),
      completed_at: v.nullable(v.date({ name: 'completed_at', description: 'Timestamp when run completed', examples: [new Date('2025-09-15T10:30:05Z')] })),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2025-09-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2026-01-10T14:45:00Z')] })
    })
  )
  .build();
