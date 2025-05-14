import { type JSONRPCRequest, type JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';

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
  id: `mtgw/ping/${seedId}_${Date.now()}`,
  method: 'ping'
});

export let jsonRpcPingResponse = (request: JSONRPCRequest) =>
  jsonRpcResponseToRequest(request, {});
