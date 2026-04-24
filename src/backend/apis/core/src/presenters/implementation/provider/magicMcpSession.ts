import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { magicMcpSessionType } from '../../types';
import { v1ConsumerIntegrationSessionPresenter } from './consumerOwnership';
import { v1MagicMcpEndpointPresenter } from './magicMcpEndpoint';
import { v1MagicMcpServerPresenter } from './magicMcpServer';

export let v1MagicMcpSessionPresenter = Presenter.create(magicMcpSessionType)
  .presenter(async ({ magicMcpSession }, opts) => {
    let consumerProfileIds = Array.from(
      new Set(
        magicMcpSession.consumerIntegrationSessions.map(
          consumerIntegrationSession => consumerIntegrationSession.consumerProfile.id
        )
      )
    );

    return {
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
      consumer_profile_id: consumerProfileIds.length ? consumerProfileIds[0]! : null,
      consumer_integration_ids: magicMcpSession.consumerIntegrationSessions.map(
        consumerIntegrationSession => consumerIntegrationSession.consumerIntegration.id
      ),
      session_id: magicMcpSession.subspaceSessionId,
      expires_at: magicMcpSession.expiresAt ?? null,

      created_at: magicMcpSession.createdAt,
      updated_at: magicMcpSession.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('magic_mcp.session'),
      id: v.string(),
      magic_mcp_server: v.nullable(v1MagicMcpServerPresenter.schema),
      magic_mcp_endpoint: v.nullable(v1MagicMcpEndpointPresenter.schema),
      consumer_profile_id: v.nullable(v.string()),
      consumer_integration_ids: v.array(v.string()),
      session_id: v.string(),
      expires_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let consumerMagicMcpSessionPresenter = Presenter.create(magicMcpSessionType)
  .presenter(async ({ magicMcpSession }, opts) => {
    let inner = await v1MagicMcpSessionPresenter.present({ magicMcpSession }, opts).run();

    return {
      ...inner,
      consumer_integration_sessions: await Promise.all(
        magicMcpSession.consumerIntegrationSessions.map(consumerIntegrationSession =>
          v1ConsumerIntegrationSessionPresenter
            .present({ consumerIntegrationSession }, opts)
            .run()
        )
      )
    };
  })
  .schema(
    v.intersection([
      v1MagicMcpSessionPresenter.schema,
      v.object({
        consumer_integration_sessions: v.array(v1ConsumerIntegrationSessionPresenter.schema)
      })
    ])
  )
  .build();
