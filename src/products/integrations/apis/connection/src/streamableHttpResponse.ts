import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

let encoder = new TextEncoder();

export let createStreamableHttpResponse = () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let started = false;
  let closed = false;
  let resolveStarted!: () => void;
  let startedPromise = new Promise<void>(resolve => {
    resolveStarted = resolve;
  });

  let body = new ReadableStream<Uint8Array>({
    start: value => {
      controller = value;
    },
    cancel: () => {
      closed = true;
    }
  });

  let write = (message: JSONRPCMessage) => {
    if (closed) return;

    controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
    if (!started) {
      started = true;
      resolveStarted();
    }
  };

  let close = () => {
    if (closed) return;
    closed = true;
    controller.close();
  };

  let error = (cause: unknown) => {
    if (closed) return;
    closed = true;
    controller.error(cause);
  };

  return {
    response: new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
      }
    }),
    started: startedPromise,
    hasStarted: () => started,
    write,
    close,
    error
  };
};

export let missingMcpResponse = (request: JSONRPCMessage): JSONRPCMessage => ({
  jsonrpc: '2.0',
  id: 'id' in request ? request.id : undefined,
  error: {
    code: -32603,
    message: 'No response produced for MCP request'
  }
});
