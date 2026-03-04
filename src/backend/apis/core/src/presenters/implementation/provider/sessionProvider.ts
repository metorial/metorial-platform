import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionProviderType } from '../../types';
import { v1ProviderConfigPreviewPresenter } from './configPreview';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';

export let v1SessionProviderPresenter = Presenter.create(sessionProviderType)
  .presenter(async ({ sessionProvider }, opts) => ({
    object: 'session.provider' as const,

    id: sessionProvider.id,
    status: sessionProvider.status,

    usage: {
      total_productive_client_message_count:
        sessionProvider.usage.totalProductiveClientMessageCount,
      total_productive_provider_message_count:
        sessionProvider.usage.totalProductiveProviderMessageCount
    },

    tool_filter: sessionProvider.toolFilter,

    provider_id: sessionProvider.providerId,
    session_id: sessionProvider.sessionId,
    from_template_id: sessionProvider.fromTemplateId,
    from_template_provider_id: sessionProvider.fromTemplateProviderId,

    deployment: await v1ProviderDeploymentPreviewPresenter
      .present({ deployment: sessionProvider.deployment }, opts)
      .run(),
    config: await v1ProviderConfigPreviewPresenter
      .present({ config: sessionProvider.config }, opts)
      .run(),
    auth_config: sessionProvider.authConfig
      ? {
          object: 'provider.auth_config#preview' as const,
          id: sessionProvider.authConfig.id
        }
      : null,

    created_at: sessionProvider.createdAt,
    updated_at: sessionProvider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session.provider', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session provider identifier',
        examples: ['spr_3cDeFgHjKlMnPqRs']
      }),
      status: v.string({
        name: 'status',
        description: 'Provider status',
        examples: ['active', 'archived']
      }),
      usage: v.object(
        {
          total_productive_client_message_count: v.number({
            name: 'total_productive_client_message_count',
            description: 'Total productive client messages'
          }),
          total_productive_provider_message_count: v.number({
            name: 'total_productive_provider_message_count',
            description: 'Total productive provider messages'
          })
        },
        { name: 'usage', description: 'Usage statistics' }
      ),
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
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      from_template_id: v.nullable(
        v.string({
          name: 'from_template_id',
          description: 'Source template ID',
          examples: ['stm_2bCdEfGhJkLmNpQr']
        })
      ),
      from_template_provider_id: v.nullable(
        v.string({
          name: 'from_template_provider_id',
          description: 'Source template provider ID',
          examples: ['stp_3cDeFgHjKlMnPqRs']
        })
      ),
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
