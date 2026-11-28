import type {
  SessionMcpToolCall,
  ToolCallRef,
  ToolCallSession
} from '@mtsrc/agent-tracking-module-sessions';

export let sessionMcpToolCallPresenter = (call: SessionMcpToolCall) => ({
  object: 'agent_tracking#session_tool_call',

  clientFamily: call.clientFamily,
  toolCallId: call.toolCallId,

  occurredAt: call.occurredAt,
  durationMs: call.durationMs,
  outcome: call.outcome,

  mcpServer: call.mcpServer,
  mcpTool: call.mcpTool
});

export let toolCallSessionPresenter = (call: ToolCallSession) => ({
  object: 'agent_tracking#tool_call_session',

  sessionKey: call.sessionKey,
  clientFamily: call.clientFamily,
  toolCallId: call.toolCallId,

  occurredAt: call.occurredAt
});

export let toolCallRefPresenter = (call: ToolCallRef) => ({
  clientFamily: call.clientFamily,
  toolCallId: call.toolCallId
});
