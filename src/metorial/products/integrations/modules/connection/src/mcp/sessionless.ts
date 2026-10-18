import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { SenderMangerProps } from '../sender';
import { McpConnection } from './connection';
import { buildSessionlessClientKey, getSessionlessClientIdentity } from './modern/clientKey';
import type { ParsedModernMcpRequest } from './modern/parse';
import { decorateModernResponse, getModernHttpStatus } from './modern/results';
import { isLongRunningMcpMethod } from './request';

export type SessionlessMcpRequest = Extract<ParsedModernMcpRequest, { type: 'request' }>;

export let handleSessionlessMcpRequest = async (
  d: Omit<SenderMangerProps, 'transport' | 'connectionToken'> & {
    request: SessionlessMcpRequest;
    clientIp?: string | null;
    onProgress?: (message: JSONRPCMessage) => Promise<void>;
    onConnection?: (connection: McpConnection) => Promise<void> | void;
  }
) => {
  let { request, clientIp, onProgress, onConnection, ...connectionInput } = d;
  let { context } = request;

  let connection = await McpConnection.create({
    ...connectionInput,
    mcpTransport: 'sessionless'
  });

  let identity = getSessionlessClientIdentity(context.clientInfo);
  let clientKey = await buildSessionlessClientKey({
    clientInfo: context.clientInfo,
    clientIp,
    agentClient: connectionInput.agentClient
  });

  await connection.resolveSessionlessConnection({
    clientKey,
    client: {
      ...context.clientInfo,
      name: identity.name,
      version: identity.version || undefined,
      identifier: identity.identifier
    },
    mcpCapabilities: context.clientCapabilities,
    mcpProtocolVersion: context.protocolVersion
  });
  await onConnection?.(connection);

  let response =
    onProgress && isLongRunningMcpMethod(request.method)
      ? await connection.handleMessageWithProgress(
          request.message,
          { waitForResponse: true },
          async event => await onProgress(event.mcp)
        )
      : await connection.handleMessage(request.message, { waitForResponse: true });

  let mcp = response?.mcp
    ? decorateModernResponse({
        method: request.method,
        message: response.mcp,
        serverInfo: await connection.getServerInfo()
      })
    : null;

  return {
    connection,
    mcp,
    httpStatus: getModernHttpStatus(mcp)
  };
};
