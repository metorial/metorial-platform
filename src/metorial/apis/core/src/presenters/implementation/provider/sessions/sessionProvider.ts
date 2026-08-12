import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionProviderType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import { v1ProviderConfigPreviewPresenter } from '../config/configPreview';
import { v1ProviderDeploymentPreviewPresenter } from '../config/deploymentPreview';

let presentToolFilter = (toolFilter: PrismaJson.ToolFilter | PrismaJson.ToolFilterChain) =>
  toolFilterPresenter(toolFilter as PrismaJson.ToolFilter);

export let v1SessionProviderPresenter = Presenter.create(sessionProviderType)
  .presenter(async ({ sessionProvider }, opts) => ({
    object: 'session.provider' as const,

    id: sessionProvider.id,
    status: sessionProvider.status,

    usage: {
      total_productive_client_message_count: sessionProvider.totalProductiveClientMessageCount,
      total_productive_provider_message_count:
        sessionProvider.totalProductiveProviderMessageCount
    },

    tool_filter: presentToolFilter(sessionProvider.toolFilter as PrismaJson.ToolFilterChain),

    provider_id: sessionProvider.provider.id,
    session_id: sessionProvider.session.id,
    from_template_id: sessionProvider.fromTemplate?.id ?? null,
    from_template_provider_id: sessionProvider.fromTemplateProvider?.id ?? null,

    deployment: await v1ProviderDeploymentPreviewPresenter
      .present(
        {
          deployment: {
            ...sessionProvider.deployment,
            provider: sessionProvider.provider
          }
        },
        opts
      )
      .run(),
    config: await v1ProviderConfigPreviewPresenter
      .present(
        {
          config: {
            ...sessionProvider.config,
            provider: sessionProvider.provider
          }
        },
        opts
      )
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
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Provider status'
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
      tool_filter: toolFilterPresenter.schema,
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
