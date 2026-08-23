import type { SessionMessage, SessionMessageStatus } from '@metorial-subspace/db';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export type ConduitInput =
  | {
      type: 'tool_call';

      sessionInstanceId: string;
      sessionMessageId: string;
      toolId: string;
      toolKey: string;
      toolCallableId: string;

      input: PrismaJson.SessionMessageInput;
    }
  | {
      type: 'mcp.message_from_client';

      sessionInstanceId: string;
      sessionMessageId: string;
      clientMcpId: string;
      mcpMessage: JSONRPCMessage;
    }
  | {
      type: 'provider.list_tools';

      sessionInstanceId: string;
    }
  | {
      type: 'provider.diagnostics';

      sessionInstanceId: string;
    };

export type ConduitListToolsResult =
  | {
      status: 'success';
      specificationId: string;
    }
  | {
      status: 'failure';
      error: { code: string; message: string };
    }
  | {
      status: 'not_supported';
    };

export type ConduitConnectionDiagnostics = {
  state: 'connecting' | 'connected' | 'failed' | 'closed';
  transport: string | null;
  protocolVersion: string | null;
  serverInfo: { name: string; version?: string; title?: string } | null;
  lastError: { code: string; message: string; detail?: string } | null;
};

export type ConduitDiagnosticsResult =
  | {
      status: 'ok';
      diagnostics: ConduitConnectionDiagnostics;
    }
  | {
      status: 'not_connected';
    };

export type ConduitHeartbeatPing = {
  type: 'health.ping';
  id: string;
  sentAt: number;
};

export type ConduitHeartbeatPong = {
  type: 'health.pong';
  id: string;
  sentAt: number;
  receivedAt: number;
};

export type ConduitResult = {
  status: SessionMessageStatus;
  completedAt: Date | null;
  message: SessionMessage | null;
  output: PrismaJson.SessionMessageOutput | null;
};

export type BroadcastMessage = {
  type: 'message_processed';
  sessionId: string;
  result: ConduitResult;
  channel: 'targeted_response' | 'broadcast_response_or_notification';
};
