import { mtMap } from '@metorial/util-resource-mapper';

export type SessionsMessagesGetOutput = {
  object: 'session.message';
  id: string;
  type:
    | 'request'
    | 'response'
    | 'notification'
    | 'error'
    | 'server_error'
    | 'unknown'
    | 'debug';
  sender: {
    object: 'session.message.sender';
    type: 'client' | 'server';
    id: string;
  };
  mcpMessage: {
    object: 'session.message.mcp_message';
    id: string;
    method: string;
    payload: Record<string, any>;
  };
  sessionId: string;
  serverSessionId: string;
  createdAt: Date;
};

export let mapSessionsMessagesGetOutput =
  mtMap.object<SessionsMessagesGetOutput>({
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

