import { McpMessage } from '@metorial/mcp-engine-generated';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { MCPMessageType, pbToMessageType } from './types';

export interface EngineMcpMessage {
  message: JSONRPCMessage;
  id?: string | number;
  type: MCPMessageType;
  method?: string;
  uuid: string;
}

export let engineMcpMessageFromPb = (msg: McpMessage): EngineMcpMessage => {
  return {
    message: JSON.parse(msg.mcpMessage!.message),
    id: msg.idJson != '' ? JSON.parse(msg.idJson) : undefined,
    type: pbToMessageType(msg.messageType),
    method: msg.method == '' ? undefined : msg.method,
    uuid: msg.mcpMessage!.uuid
  };
};
