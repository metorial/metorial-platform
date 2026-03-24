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
