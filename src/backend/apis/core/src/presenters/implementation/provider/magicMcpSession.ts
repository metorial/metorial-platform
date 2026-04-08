import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { magicMcpSessionType } from '../../types';
import { v1MagicMcpEndpointPresenter } from './magicMcpEndpoint';
import { v1MagicMcpServerPresenter } from './magicMcpServer';

export let v1MagicMcpSessionPresenter = Presenter.create(magicMcpSessionType)
  .presenter(async ({ magicMcpSession }, opts) => ({
    object: 'magic_mcp.session' as const,
    id: magicMcpSession.id,
    magic_mcp_server: magicMcpSession.magicMcpServer
      ? await v1MagicMcpServerPresenter
          .present({ magicMcpServer: magicMcpSession.magicMcpServer }, opts)
          .run()
      : null,
    magic_mcp_endpoint: magicMcpSession.magicMcpEndpoint
      ? await v1MagicMcpEndpointPresenter
          .present({ magicMcpEndpoint: magicMcpSession.magicMcpEndpoint }, opts)
          .run()
      : null,
    session_id: magicMcpSession.subspaceSessionId,

    created_at: magicMcpSession.createdAt,
    updated_at: magicMcpSession.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('magic_mcp.session'),
      id: v.string(),
      magic_mcp_server: v.nullable(v1MagicMcpServerPresenter.schema),
      magic_mcp_endpoint: v.nullable(v1MagicMcpEndpointPresenter.schema),
      session_id: v.string(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
