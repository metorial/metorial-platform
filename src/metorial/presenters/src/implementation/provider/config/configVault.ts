import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerConfigVaultType } from '../../../types';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';

export let v1ProviderConfigVaultPresenter = Presenter.create(providerConfigVaultType)
  .presenter(async ({ configVault }, opts) => ({
    object: 'provider.config_vault' as const,

    id: configVault.id,

    status: configVault.status,

    name: configVault.name,
    description: configVault.description,
    metadata: configVault.metadata,

    provider_id: configVault.provider.id,

    deployment: configVault.deployment
      ? await v1ProviderDeploymentPreviewPresenter
          .present(
            {
              deployment: {
                ...configVault.deployment,
                provider: configVault.provider
              }
            },
            opts
          )
          .run()
      : null,

    created_at: configVault.createdAt,
    updated_at: configVault.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.config_vault', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['pcvt_3bCdEfGhJkLmNpQr']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'] as const, {
        name: 'status',
        description: 'Archived once the vault is archived. Archived vaults stay listable.'
      }),
      name: v.string({
        name: 'name',
        description: 'Display name.',
        examples: ['Production Secrets']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Secure storage for production credentials']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.',
          examples: [{ owner: 'platform-team', sensitivity: 'high' }]
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider this vault belongs to.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      deployment: v.nullable(v1ProviderDeploymentPreviewPresenter.schema),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
