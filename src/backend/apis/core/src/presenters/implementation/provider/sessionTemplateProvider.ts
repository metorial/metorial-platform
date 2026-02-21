import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerSessionTemplateProviderType } from '../../types';

export let v1SessionTemplateProviderPresenter = Presenter.create(
  providerSessionTemplateProviderType
)
  .presenter(async ({ sessionTemplateProvider }) => ({
    object: 'session.template.provider' as const,
    id: sessionTemplateProvider.id,
    name: sessionTemplateProvider.name,
    description: sessionTemplateProvider.description,
    metadata: sessionTemplateProvider.metadata,
    session_template_id: sessionTemplateProvider.sessionTemplateId,
    provider_id: sessionTemplateProvider.providerId,
    provider_deployment_id:
      sessionTemplateProvider.providerDeploymentId ??
      sessionTemplateProvider.deployment?.id ??
      null,
    provider_deployment_name: sessionTemplateProvider.deployment?.name ?? null,
    provider_config_name: sessionTemplateProvider.config?.name ?? null,
    provider_auth_config_name: sessionTemplateProvider.authConfig?.name ?? null,
    created_at: sessionTemplateProvider.createdAt,
    updated_at: sessionTemplateProvider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session.template.provider', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session template provider identifier',
        examples: ['stp_3cDeFgHjKlMnPqRs']
      }),
      name: v.nullable(
        v.string({ name: 'name', description: 'Display name', examples: ['GitHub Provider'] })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['GitHub integration for this template']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs',
          examples: [{ priority: 1 }]
        })
      ),
      session_template_id: v.string({
        name: 'session_template_id',
        description: 'Parent session template ID',
        examples: ['stm_2bCdEfGhJkLmNpQr']
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      provider_deployment_id: v.nullable(
        v.string({
          name: 'provider_deployment_id',
          description: 'Provider deployment ID',
          examples: ['pde_1aBcDeFgHjKlMnPq']
        })
      ),
      provider_deployment_name: v.nullable(
        v.string({
          name: 'provider_deployment_name',
          description: 'Provider deployment name',
          examples: ['Production']
        })
      ),
      provider_config_name: v.nullable(
        v.string({
          name: 'provider_config_name',
          description: 'Provider config name',
          examples: ['Default Config']
        })
      ),
      provider_auth_config_name: v.nullable(
        v.string({
          name: 'provider_auth_config_name',
          description: 'Provider auth config name',
          examples: ['OAuth Config']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
