import { McpMessage, McpMessageRaw, McpMessageType } from '@metorial/mcp-engine-generated';
import { getMessageType } from '@metorial/mcp-utils';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { uuidv7 } from 'uuidv7';
import { Participant } from './participant';
import { MCPMessageType, pbToMessageType } from './types';

export interface EngineMcpMessage {
  message: JSONRPCMessage;
  id?: string | number;
  type: MCPMessageType;
  method?: string;
  uuid: string;
  from: Participant;
}

export let engineMcpMessageFromPb = (msg: McpMessage, from: Participant): EngineMcpMessage => {
  return {
    message: JSON.parse(msg.mcpMessage!.message),
    id: msg.idJson != '' ? JSON.parse(msg.idJson) : undefined,
    type: pbToMessageType(msg.messageType),
    method: msg.method == '' ? undefined : msg.method,
    uuid: msg.mcpMessage!.uuid,
    from
  };
};

export let engineMcpMessageToPb = (msg: EngineMcpMessage): McpMessage => {
  return {
    mcpMessage: {
      message: JSON.stringify(msg.message),
      uuid: msg.uuid
    },
    idJson: msg.id !== undefined ? JSON.stringify(msg.id) : '',
    idString: msg.id !== undefined ? String(msg.id) : '',
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

export let fromJSONRPCMessage = (msg: JSONRPCMessage, from: Participant): EngineMcpMessage => {
  return {
    message: msg,
    id: 'id' in msg ? msg.id : undefined,
    type: getMessageType(msg),
    method: 'method' in msg ? msg.method : undefined,
    uuid: uuidv7(),
    from
  };
};
