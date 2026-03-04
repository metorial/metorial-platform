import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionTemplateProviderType } from '../../types';
import { v1ProviderConfigPreviewPresenter } from './configPreview';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';

export let v1SessionTemplateProviderPresenter = Presenter.create(sessionTemplateProviderType)
  .presenter(async ({ sessionTemplateProvider }, opts) => ({
    object: 'session.template.provider' as const,

    id: sessionTemplateProvider.id,

    status: sessionTemplateProvider.status,
    tool_filter: sessionTemplateProvider.toolFilter,

    provider_id: sessionTemplateProvider.providerId,
    session_template_id: sessionTemplateProvider.sessionTemplateId,

    deployment: await v1ProviderDeploymentPreviewPresenter
      .present({ deployment: sessionTemplateProvider.deployment }, opts)
      .run(),

    config: await v1ProviderConfigPreviewPresenter
      .present({ config: sessionTemplateProvider.config }, opts)
      .run(),

    auth_config: sessionTemplateProvider.authConfig
      ? {
          object: 'provider.auth_config#preview' as const,
          id: sessionTemplateProvider.authConfig.id
        }
      : null,

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
      status: v.string({
        name: 'status',
        description: 'Provider status',
        examples: ['active', 'archived']
      }),
      tool_filter: v.union(
        [
          v.object({ type: v.literal('v1.allow_all') }),
          v.object({
            type: v.literal('v1.filter'),
            filters: v.array(
              v.union(
                [
                  v.object({
                    type: v.literal('tool_keys'),
                    keys: v.array(v.string())
                  }),
                  v.object({
                    type: v.literal('tool_regex'),
                    pattern: v.string()
                  }),
                  v.object({
                    type: v.literal('resource_regex'),
                    pattern: v.string()
                  }),
                  v.object({
                    type: v.literal('resource_uris'),
                    uris: v.array(v.string())
                  }),
                  v.object({
                    type: v.literal('prompt_keys'),
                    keys: v.array(v.string())
                  }),
                  v.object({
                    type: v.literal('prompt_regex'),
                    pattern: v.string()
                  })
                ],
                { name: 'filter', description: 'A tool filter entry' }
              )
            )
          })
        ],
        { name: 'tool_filter', description: 'Tool filter configuration' }
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      session_template_id: v.string({
        name: 'session_template_id',
        description: 'Parent session template ID',
        examples: ['stm_2bCdEfGhJkLmNpQr']
      }),
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      config: v1ProviderConfigPreviewPresenter.schema,
      auth_config: v.nullable(
        v.object({
          object: v.literal('provider.auth_config#preview'),
          id: v.string()
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
