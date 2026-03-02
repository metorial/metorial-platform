import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { magicMcpSessionType } from '../../types';

export let v1MagicMcpSessionPresenter = Presenter.create(magicMcpSessionType)
  .presenter(async ({ magicMcpSession }) => ({
    object: 'magic_mcp.session' as const,
    id: magicMcpSession.id,
    subspace_session_id: magicMcpSession.subspaceSessionId,
    subspace_session_template_id: magicMcpSession.subspaceSessionTemplateId,
    magic_mcp_server: {
      id: magicMcpSession.magicMcpServer.id,
      status: magicMcpSession.magicMcpServer.status,
      name: magicMcpSession.magicMcpServer.name,
      description: magicMcpSession.magicMcpServer.description,
      metadata: magicMcpSession.magicMcpServer.metadata,
      created_at: magicMcpSession.magicMcpServer.createdAt,
      updated_at: magicMcpSession.magicMcpServer.updatedAt
    },
    created_at: magicMcpSession.createdAt,
    updated_at: magicMcpSession.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('magic_mcp.session'),
      id: v.string(),
      subspace_session_id: v.string(),
      subspace_session_template_id: v.string(),
      magic_mcp_server: v.object({
        id: v.string(),
        status: v.enumOf(['active', 'archived', 'deleted']),
        name: v.nullable(v.string()),
        description: v.nullable(v.string()),
        metadata: v.record(v.any()),
        created_at: v.date(),
        updated_at: v.date()
      }),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
