import { Presenter } from '@metorial/presenter';
import { v } from '@lowerdeck/validation';
import { magicMcpSessionType } from '../../types';
import { v1MagicMcpServerPresenter } from './magicMcpServer';

export let v1MagicMcpSessionPresenter = Presenter.create(magicMcpSessionType)
  .presenter(async ({ magicMcpSession }, opts) => ({
    object: 'magic_mcp.session' as const,
    id: magicMcpSession.id,
    subspace_session_id: magicMcpSession.subspaceSessionId,
    subspace_session_template_id: magicMcpSession.subspaceSessionTemplateId,
    magic_mcp_server: await v1MagicMcpServerPresenter
      .present({ magicMcpServer: magicMcpSession.magicMcpServer }, opts)
      .run(),
    created_at: magicMcpSession.createdAt,
    updated_at: magicMcpSession.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('magic_mcp.session'),
      id: v.string(),
      subspace_session_id: v.string(),
      subspace_session_template_id: v.string(),
      magic_mcp_server: v1MagicMcpServerPresenter.schema,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
