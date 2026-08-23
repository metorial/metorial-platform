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
  }
) => {
  let { message, waitForResponse, onProgress, ...connectionInput } = d;
  let connection = await McpConnection.create(connectionInput);

  let method = 'method' in message ? message.method : undefined;
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
