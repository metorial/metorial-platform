import { type JSONRPCRequest, type JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';
import { MCP_IDS } from '../systemIds';

export let jsonRpcResponseToRequest = (
  request: JSONRPCRequest,
  result: Record<string, any>
): JSONRPCResponse => ({
  jsonrpc: '2.0',
  id: request.id,
  result
});

export let jsonRpcPingRequest = (seedId: string): JSONRPCRequest => ({
  jsonrpc: '2.0',
  id: `${MCP_IDS.PING}${seedId}_${Date.now()}`,
  method: 'ping'
});

export let jsonRpcPingResponse = (request: JSONRPCRequest) =>
  jsonRpcResponseToRequest(request, {});
