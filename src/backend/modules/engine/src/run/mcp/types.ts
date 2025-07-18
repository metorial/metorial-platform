import { SessionMessageType } from '@metorial/db';
import { McpMessageType } from '@metorial/mcp-engine-generated';

export type MCPMessageType = SessionMessageType;

export let pbToMessageType = (type: McpMessageType): MCPMessageType => {
  switch (type) {
    case McpMessageType.request:
      return 'request';
    case McpMessageType.response:
      return 'response';
    case McpMessageType.notification:
      return 'notification';
    case McpMessageType.error:
      return 'error';
    default:
      return 'unknown';
  }
};

export let messageTypeToPb = (type: MCPMessageType): McpMessageType => {
  switch (type) {
    case 'request':
      return McpMessageType.request;
    case 'response':
      return McpMessageType.response;
    case 'notification':
      return McpMessageType.notification;
    case 'error':
      return McpMessageType.error;
    default:
      return McpMessageType.unknown;
  }
};
