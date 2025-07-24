import { McpMessage, McpMessageRaw, McpMessageType } from '@metorial/mcp-engine-generated';
import { getMessageType } from '@metorial/mcp-utils';
import { UnifiedID } from '@metorial/unified-id';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { uuidv7 } from 'uuidv7';
import { Participant } from './participant';
import { MCPMessageType, pbToMessageType } from './types';

export interface EngineMcpMessage {
  message: JSONRPCMessage;
  originalId: string | number | undefined;
  unifiedId: string | undefined;
  type: MCPMessageType;
  method?: string;
  uuid: string;

  sender: Participant;
  senderType: 'client' | 'server';
}

export let engineMcpMessageFromPb = (
  msg: McpMessage,
  sender: Participant,
  unifiedIdGen: UnifiedID
): EngineMcpMessage => {
  let originalId = msg.idJson != '' ? JSON.parse(msg.idJson) : undefined;
  let unifiedId =
    originalId !== undefined
      ? unifiedIdGen.serialize({
          originalId,
          sender
        })
      : undefined;

  return {
    message: JSON.parse(msg.mcpMessage!.message),

    originalId,
    unifiedId,

    type: pbToMessageType(msg.messageType),
    method: msg.method == '' ? undefined : msg.method,
    uuid: msg.mcpMessage!.uuid,

    sender,
    senderType: sender.type
  };
};

export let engineMcpMessageToPb = (msg: EngineMcpMessage): McpMessage => {
  return {
    mcpMessage: {
      message: JSON.stringify(msg.message),
      uuid: msg.uuid
    },
    idJson: msg.originalId !== undefined ? JSON.stringify(msg.originalId) : '',
    idString: msg.originalId !== undefined ? String(msg.originalId) : '',
    messageType: messageTypeToPb(msg.type),
    method: msg.method ?? ''
  };
};

export let engineMcpMessageToPbRaw = (msg: EngineMcpMessage): McpMessageRaw => {
  return {
    message: JSON.stringify(msg.message),
    uuid: msg.uuid
  };
};

export let messageTypeToPb = (type: MCPMessageType): McpMessageType => {
  switch (type) {
    case 'error':
      return McpMessageType.error;
    case 'notification':
      return McpMessageType.notification;
    case 'request':
      return McpMessageType.request;
    case 'response':
      return McpMessageType.response;
    default:
      return McpMessageType.unknown;
  }
};

export let fromJSONRPCMessage = (
  msg: JSONRPCMessage,
  sender: Participant,
  unifiedIdGen: UnifiedID
): EngineMcpMessage => {
  let originalId = 'id' in msg ? msg.id : undefined;
  let unifiedId =
    originalId !== undefined
      ? unifiedIdGen.serialize({
          originalId,
          sender
        })
      : undefined;

  return {
    message: msg,

    originalId,
    unifiedId,

    type: getMessageType(msg),
    method: 'method' in msg ? msg.method : undefined,
    uuid: uuidv7(),

    sender,
    senderType: sender.type
  };
};
