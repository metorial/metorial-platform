import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { SenderMangerProps } from '../sender';
import { McpConnection } from './connection';

export let isLongRunningMcpMethod = (method: unknown) =>
  method === 'tools/call' || method === 'prompts/get' || method === 'resources/read';

export let handleMcpRequest = async (
  d: Omit<SenderMangerProps, 'transport'> & {
    mcpTransport: 'sse' | 'streamable_http';
    message: JSONRPCMessage;
    waitForResponse: boolean;
    onProgress?: (message: JSONRPCMessage) => Promise<void>;
    onConnection?: (connection: McpConnection) => Promise<void> | void;
  }
) => {
  let { message, waitForResponse, onProgress, onConnection, ...connectionInput } = d;
  let method = 'method' in message ? message.method : undefined;

  let connection = await McpConnection.create(connectionInput);
  await onConnection?.(connection);

  let response =
    onProgress && isLongRunningMcpMethod(method)
      ? await connection.handleMessageWithProgress(
          message,
          { waitForResponse },
          async event => await onProgress(event.mcp)
        )
      : await connection.handleMessage(message, { waitForResponse });

  return { connection, response };
};
