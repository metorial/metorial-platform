import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

let sseResponse = (messages: JSONRPCMessage[]) => {
  let body = messages.map(message => `data: ${JSON.stringify(message)}\n\n`).join('');
  return new Response(body, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
};

export let createStreamableHttpPostResponse = (d: {
  request: JSONRPCMessage;
  response?: JSONRPCMessage | null;
  progress: JSONRPCMessage[];
}) => {
  if (!d.response && d.progress.length === 0) {
    return new Response(null, { status: 202 });
  }

  let responseMessage = d.response ?? {
    jsonrpc: '2.0' as const,
    id: 'id' in d.request ? d.request.id : undefined,
    error: {
      code: -32603,
      message: 'No response produced for MCP request'
    }
  };

  if (d.progress.length === 0) {
    return Response.json(responseMessage);
  }

  return sseResponse([...d.progress, responseMessage]);
};
