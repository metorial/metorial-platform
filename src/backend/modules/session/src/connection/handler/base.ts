import {
  Instance,
  Organization,
  ServerDeployment,
  ServerSession,
  ServerVariant,
  SessionMessageType
} from '@metorial/db';
import { JSONRPCMessage } from '@metorial/mcp-utils';

export interface ConnectionMessage {
  message: JSONRPCMessage;
  trackingId?: string;
  type?: SessionMessageType;
}

export abstract class BaseConnectionHandler {
  constructor(
    protected readonly session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    },
    protected readonly instance: Instance & { organization: Organization }
  ) {}

  abstract sendMessage(
    message: JSONRPCMessage[],
    opts: {
      includeResponses?: boolean;
      onResponse?: (message: ConnectionMessage) => void;
    }
  ): Promise<{ responses: ConnectionMessage[] }>;

  abstract onMessage(
    opts: {
      type: SessionMessageType[];
      ids?: string[];
      replayAfterTrackingId?: string;
    },
    handler: (message: ConnectionMessage) => void
  ): Promise<void>;

  abstract close(): Promise<void>;

  abstract readonly mode: 'send-only' | 'send-and-receive';
}
