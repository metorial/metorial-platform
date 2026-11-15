import { eventually, expectOk, metorialEndpoints, type RestClient } from '@metorial/e2e';

export interface SseEvent {
  event: string;
  data: string;
}

export interface RawMcpResponse {
  status: number;
  headers: Headers;
  text: string;
  messages: any[];
}

export let mcpEndpoint = () => {
  let url = metorialEndpoints().mcp;
  if (!url) throw new Error('The e2e stack does not expose an mcp endpoint');
  return url;
};

export let connectionUrl = (sessionId: string) => `${mcpEndpoint()}/connect/mcp/${sessionId}`;

export let bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export let initializeMessage = (id: number | string = 1) => ({
  jsonrpc: '2.0',
  id,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'metorial-e2e', version: '1.0.0' }
  }
});

export let parseSseEvents = (text: string): SseEvent[] =>
  text
    .split(/\r?\n\r?\n/)
    .map(block => {
      let event = 'message';
      let data: string[] = [];

      for (let line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data.push(line.slice(5).trim());
      }

      return data.length ? { event, data: data.join('\n') } : null;
    })
    .filter((event): event is SseEvent => event !== null);

let parseMessages = (contentType: string, text: string) => {
  if (!text) return [];

  if (contentType.includes('text/event-stream')) {
    return parseSseEvents(text).map(event => JSON.parse(event.data));
  }

  try {
    let body = JSON.parse(text);
    return Array.isArray(body) ? body : [body];
  } catch {
    return [];
  }
};

/** Sends one raw HTTP request to a connection URL; `body` is sent verbatim when it is a string. */
export let rawMcp = async (
  url: string,
  input: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
): Promise<RawMcpResponse> => {
  let response = await fetch(url, {
    method: input.method ?? 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      ...(input.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...input.headers
    },
    body:
      input.body === undefined
        ? undefined
        : typeof input.body === 'string'
          ? input.body
          : JSON.stringify(input.body)
  });

  let text = await response.text();

  return {
    status: response.status,
    headers: response.headers,
    text,
    messages: parseMessages(response.headers.get('content-type') ?? '', text)
  };
};

/** Opens a long-lived SSE GET and collects its events in the background until `close()`. */
export let openEventStream = async (url: string, headers: Record<string, string>) => {
  let abort = new AbortController();
  let response = await fetch(url, {
    headers: { accept: 'text/event-stream', ...headers },
    signal: abort.signal
  });

  let events: SseEvent[] = [];

  let pump = (async () => {
    if (!response.body) return;

    let reader = response.body.getReader();
    let decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        let { done, value } = await reader.read();
        if (done) return;

        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.lastIndexOf('\n\n');
        if (boundary === -1) continue;

        events.push(...parseSseEvents(buffer.slice(0, boundary)));
        buffer = buffer.slice(boundary + 2);
      }
    } catch {}
  })();

  let waitFor = (predicate: (event: SseEvent) => boolean, timeoutMs = 30_000) =>
    eventually(
      () => {
        let event = events.find(predicate);
        if (!event) {
          throw new Error(`No matching SSE event in ${JSON.stringify(events).slice(0, 2000)}`);
        }
        return event;
      },
      { timeoutMs, intervalMs: 100 }
    );

  let waitForMessage = async (id: number | string, timeoutMs?: number) => {
    let event = await waitFor(event => {
      try {
        return JSON.parse(event.data)?.id === id;
      } catch {
        return false;
      }
    }, timeoutMs);
    return JSON.parse(event.data);
  };

  return {
    status: response.status,
    headers: response.headers,
    events,
    waitFor,
    waitForMessage,
    close: async () => {
      abort.abort();
      await pump;
    }
  };
};

export let listForSession = async (client: RestClient, path: string, sessionId: string) =>
  expectOk(await client.get(path, { query: { session_id: sessionId, limit: 100 } }))
    .items as any[];
