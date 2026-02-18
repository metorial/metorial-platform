import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionsMessagesGetOutput = {
  object: 'session.message';
  id: string;
  type: string;
  sender: { object: 'session.message.sender'; type: string; id: string | null };
  mcpMessage: {
    object: 'session.message.mcp_message';
    id: string;
    originalId: string | null;
    method: string | null;
    payload: Record<string, any>;
  };
  sessionId: string;
  serverSessionId: string;
  createdAt: Date;
};

export let mapDashboardInstanceSessionsMessagesGetOutput =
  mtMap.object<DashboardInstanceSessionsMessagesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    sender: mtMap.objectField(
      'sender',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough())
      })
    ),
    mcpMessage: mtMap.objectField(
      'mcp_message',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        originalId: mtMap.objectField('original_id', mtMap.passthrough()),
        method: mtMap.objectField('method', mtMap.passthrough()),
        payload: mtMap.objectField('payload', mtMap.passthrough())
      })
    ),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    serverSessionId: mtMap.objectField(
      'server_session_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

