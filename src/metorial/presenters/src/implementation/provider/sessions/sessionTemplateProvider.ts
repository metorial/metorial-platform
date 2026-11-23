import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionTemplateProviderType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import { v1ProviderConfigPreviewPresenter } from '../config/configPreview';
import { v1ProviderDeploymentPreviewPresenter } from '../config/deploymentPreview';

export let v1SessionTemplateProviderPresenter = Presenter.create(sessionTemplateProviderType)
  .presenter(async ({ sessionTemplateProvider }, opts) => ({
    object: 'session.template.provider' as const,

    id: sessionTemplateProvider.id,

    status: sessionTemplateProvider.status,
    tool_filter: toolFilterPresenter(
      sessionTemplateProvider.toolFilter as PrismaJson.ToolFilter
    ),

    provider_id: sessionTemplateProvider.provider.id,
    session_template_id: sessionTemplateProvider.sessionTemplate.id,

    deployment: await v1ProviderDeploymentPreviewPresenter
      .present(
        {
          deployment: {
            ...sessionTemplateProvider.deployment,
            provider: sessionTemplateProvider.provider
          }
        },
        opts
      )
      .run(),

    config: await v1ProviderConfigPreviewPresenter
      .present(
        {
          config: {
            ...sessionTemplateProvider.config,
            provider: sessionTemplateProvider.provider
          }
        },
        opts
      )
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
        description: "String representing the object’s type."
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['stp_3cDeFgHjKlMnPqRs']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description:
          '`archived` once the template provider is removed. Removed template providers stay listable.'
      }),
      tool_filter: toolFilterPresenter.schema,
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider this template provider connects to.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      session_template_id: v.string({
        name: 'session_template_id',
        description: 'Template this provider belongs to.',
        examples: ['stm_2bCdEfGhJkLmNpQr']
      }),
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      config: v1ProviderConfigPreviewPresenter.schema,
      auth_config: v.nullable(
        v.object(
          {
            object: v.literal('provider.auth_config#preview', {
              description: "String representing the object’s type."
            }),
            id: v.string({ description: 'Unique ID.' })
          },
          {
            name: 'auth_config',
            description: 'Auth config the provider runs with. `null` when there is none.'
          }
        )
      ),
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
