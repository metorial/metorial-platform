import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { magicMcpServerProviderType } from '../../types';
import { toolFilterPresenter } from '../_lib/toolFilter';
import { v1ProviderConfigPreviewPresenter } from './configPreview';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';

export let v1MagicMcpServerProviderPresenter = Presenter.create(magicMcpServerProviderType)
  .presenter(async ({ magicMcpServer, sessionTemplateProvider }, opts) => ({
    object: 'magic_mcp.server.provider' as const,

    id: sessionTemplateProvider.id,

    status: sessionTemplateProvider.status,
    tool_filter: toolFilterPresenter(sessionTemplateProvider.toolFilter),

    provider_id: sessionTemplateProvider.providerId,
    magic_mcp_server_id: magicMcpServer.id,

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
      object: v.literal('magic_mcp.server.provider', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique magic MCP server provider identifier',
        examples: ['stp_3cDeFgHjKlMnPqRs']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Provider status'
      }),
      tool_filter: toolFilterPresenter.schema,
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      magic_mcp_server_id: v.string({
        name: 'magic_mcp_server_id',
        description: 'Parent magic MCP server ID',
        examples: ['mgs_2bCdEfGhJkLmNpQr']
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
