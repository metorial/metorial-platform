import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerActivityAgentType, consumerActivitySessionConnectionType } from '../../types';
import {
  v1AgentPresenter,
  v1MagicMcpEndpointPresenter,
  v1SessionConnectionPresenter
} from '../provider';

export let v1ConsumerActivityAgentPresenter = Presenter.create(consumerActivityAgentType)
  .presenter(async ({ agent, magicMcpEndpoints }, opts) => ({
    object: 'consumer.activity_agent' as const,
    agent: await v1AgentPresenter.present({ agent }, opts).run(),
    magic_mcp_endpoints: await Promise.all(
      magicMcpEndpoints.map(magicMcpEndpoint =>
        v1MagicMcpEndpointPresenter.present({ magicMcpEndpoint }, opts).run()
      )
    )
  }))
  .schema(
    v.object({
      object: v.literal('consumer.activity_agent'),
      agent: v1AgentPresenter.schema,
      magic_mcp_endpoints: v.array(v1MagicMcpEndpointPresenter.schema)
    })
  )
  .build();

export let v1ConsumerActivitySessionConnectionPresenter = Presenter.create(
  consumerActivitySessionConnectionType
)
  .presenter(async ({ sessionConnection, magicMcpSession }, opts) => ({
    object: 'consumer.activity_session_connection' as const,
    connection: await v1SessionConnectionPresenter.present({ sessionConnection }, opts).run(),
    magic_mcp_session_id: magicMcpSession?.id ?? null,
    magic_mcp_endpoint_id: magicMcpSession?.magicMcpEndpoint?.id ?? null,
    magic_mcp_server_id: magicMcpSession?.magicMcpServer?.id ?? null
  }))
  .schema(
    v.object({
      object: v.literal('consumer.activity_session_connection'),
      connection: v1SessionConnectionPresenter.schema,
      magic_mcp_session_id: v.nullable(v.string()),
      magic_mcp_endpoint_id: v.nullable(v.string()),
      magic_mcp_server_id: v.nullable(v.string())
    })
  )
  .build();
