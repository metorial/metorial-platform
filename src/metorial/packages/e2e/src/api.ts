import { createClient, type ClientOpts } from '@lowerdeck/rpc-client';
import { createMetorialConsumerSDK, type MetorialConsumerSDK } from '@metorial/consumer-sdk';
import {
  createMetorialDashboardSDK,
  type MetorialDashboardSDK
} from '@metorial/dashboard-sdk';
import { metorialEndpoints } from './env';

export let SESSION_COOKIE = 'metorial_oss_session_secret';

export let API_VERSIONS = {
  dashboard: 'mt_2025_01_01_dashboard',
  magnetar: 'mt_2026_01_01_magnetar',
  consumer: 'mt_2026_04_01_consumer'
} as const;

export interface RestAuth {
  apiKey?: string;
  session?: string;
  organizationId?: string;
  consumerToken?: string;
  version?: string;
  headers?: Record<string, string>;
}

export interface RestResponse<T = any> {
  method: string;
  url: string;
  status: number;
  ok: boolean;
  headers: Headers;
  body: T;
  text: string;
}

export interface RestRequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

export class RestError extends Error {
  constructor(public response: RestResponse) {
    super(
      `${response.method} ${response.url} responded ${response.status}: ${response.text.slice(0, 2000)}`
    );
  }
}

export let authHeaders = (auth: RestAuth = {}) => {
  let headers: Record<string, string> = {};
  if (auth.version) headers['metorial-version'] = auth.version;
  if (auth.apiKey) headers.authorization = `Bearer ${auth.apiKey}`;
  if (auth.session) headers.cookie = `${SESSION_COOKIE}=${auth.session}`;
  if (auth.organizationId) headers['metorial-organization-id'] = auth.organizationId;
  if (auth.consumerToken) {
    headers['metorial-consumer-session-client-secret'] = auth.consumerToken;
  }
  return { ...headers, ...auth.headers };
};

/** Returns the parsed body of a 2xx response and throws a `RestError` with the body otherwise. */
export let expectOk = <T>(response: RestResponse<T>) => {
  if (!response.ok) throw new RestError(response);
  return response.body;
};

export let rest = (baseUrl: string, auth: RestAuth = {}) => {
  let request = async <T = any>(
    method: string,
    path: string,
    options: RestRequestOptions = {}
  ): Promise<RestResponse<T>> => {
    let url = new URL(path, baseUrl);
    for (let [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let hasBody = options.body !== undefined;
    let response = await fetch(url, {
      method,
      redirect: 'manual',
      headers: {
        accept: 'application/json',
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
        ...authHeaders(auth),
        ...options.headers
      },
      body: hasBody ? JSON.stringify(options.body) : undefined
    });

    let text = await response.text();
    let body: any = undefined;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    return {
      method,
      url: url.toString(),
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      body,
      text
    };
  };

  return {
    baseUrl,
    auth,
    request,
    get: <T = any>(path: string, options?: Omit<RestRequestOptions, 'body'>) =>
      request<T>('GET', path, options),
    post: <T = any>(path: string, body?: unknown, options?: RestRequestOptions) =>
      request<T>('POST', path, { ...options, body }),
    patch: <T = any>(path: string, body?: unknown, options?: RestRequestOptions) =>
      request<T>('PATCH', path, { ...options, body }),
    put: <T = any>(path: string, body?: unknown, options?: RestRequestOptions) =>
      request<T>('PUT', path, { ...options, body }),
    delete: <T = any>(path: string, options?: RestRequestOptions) =>
      request<T>('DELETE', path, options),
    with: (extra: RestAuth) => rest(baseUrl, { ...auth, ...extra })
  };
};

export type RestClient = ReturnType<typeof rest>;

export let dashboardSdk = (
  auth: RestAuth & { instanceId?: string; apiHost?: string } = {}
): MetorialDashboardSDK =>
  createMetorialDashboardSDK({
    apiHost: auth.apiHost ?? metorialEndpoints().api,
    organizationId: auth.organizationId,
    instanceId: auth.instanceId,
    headers: authHeaders(auth)
  });

export let consumerSdk = (auth: {
  apiKey: string;
  consumerToken: string;
  apiHost?: string;
}): MetorialConsumerSDK =>
  createMetorialConsumerSDK({
    apiHost: auth.apiHost ?? metorialEndpoints().api,
    apiKey: auth.apiKey,
    consumerToken: auth.consumerToken
  });

/** An internal RPC client; the API under test passes its own client type as `T`. */
export let rpc = <T extends object>(
  endpoint: string,
  options: Omit<ClientOpts, 'endpoint'> = {}
) => createClient<T>({ retry: false, ...options, endpoint });

export interface McpResponse {
  status: number;
  sessionId: string | null;
  result?: any;
  error?: { code: number; message: string; data?: unknown };
}

let parseMcpBody = (contentType: string, text: string, id: number) => {
  if (!contentType.includes('text/event-stream')) return text ? JSON.parse(text) : undefined;
  let messages = text
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
  return messages.find(message => message.id === id) ?? messages.at(-1);
};

/** A minimal streamable-HTTP MCP client: enough for `initialize` and `tools/list` smoke checks. */
export let mcp = (url: string, auth: RestAuth = {}) => {
  let sessionId: string | null = null;
  let nextId = 0;

  let send = async (method: string, params: unknown, notification = false) => {
    let id = ++nextId;
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
        ...authHeaders(auth)
      },
      body: JSON.stringify(
        notification
          ? { jsonrpc: '2.0', method, params }
          : { jsonrpc: '2.0', id, method, params }
      )
    });
    sessionId = response.headers.get('mcp-session-id') ?? sessionId;
    let text = await response.text();
    let message = notification
      ? undefined
      : parseMcpBody(response.headers.get('content-type') ?? '', text, id);
    return {
      status: response.status,
      sessionId,
      result: message?.result,
      error: message?.error
    } satisfies McpResponse;
  };

  return {
    request: (method: string, params: unknown = {}) => send(method, params),
    notify: (method: string, params: unknown = {}) => send(method, params, true),
    initialize: async () => {
      let response = await send('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'metorial-e2e', version: '1.0.0' }
      });
      if (response.result) await send('notifications/initialized', {}, true);
      return response;
    },
    listTools: () => send('tools/list', {}),
    get sessionId() {
      return sessionId;
    }
  };
};
