import { expectOk, rest, type RestClient, type RestResponse } from './api';

export interface ApiErrorBody {
  object: 'error';
  ok: false;
  status: number;
  code: string;
  message: string;
  [key: string]: unknown;
}

let describeResponse = (response: RestResponse) =>
  `${response.method} ${response.url} responded ${response.status}: ${response.text.slice(0, 1000)}`;

/** Asserts an error response with the given status (and code), and returns the error body. */
export let expectError = (
  response: RestResponse,
  status: number,
  code?: string
): ApiErrorBody => {
  if (response.status !== status) {
    throw new Error(`Expected status ${status}, but ${describeResponse(response)}`);
  }
  if (response.body?.object !== 'error') {
    throw new Error(`Expected an error body, but ${describeResponse(response)}`);
  }
  if (code !== undefined && response.body.code !== code) {
    throw new Error(`Expected error code "${code}", but ${describeResponse(response)}`);
  }
  return response.body;
};

/** Awaits a service call that must throw a `ServiceError` with the given code, and returns its data. */
export let expectServiceError = async (
  promise: Promise<unknown>,
  code: string
): Promise<{ code: string; message: string; status?: number; [key: string]: unknown }> => {
  let error: any;
  try {
    await promise;
  } catch (caught) {
    error = caught;
  }
  if (!error) throw new Error(`Expected a ServiceError "${code}", but the call resolved`);
  if (error.data?.code !== code) {
    throw new Error(`Expected a ServiceError "${code}", but got: ${error.stack ?? error}`);
  }
  return error.data;
};

/** Follows `pagination.after` cursors until the list is exhausted and returns every item. */
export let listAll = async <T = any>(
  client: RestClient,
  path: string,
  options: {
    query?: Record<string, string | number | boolean | undefined>;
    limit?: number;
    maxPages?: number;
  } = {}
): Promise<T[]> => {
  let items: T[] = [];
  let after: string | undefined;
  let maxPages = options.maxPages ?? 50;

  for (let page = 0; page < maxPages; page++) {
    let body = expectOk(
      await client.get(path, {
        query: { ...options.query, limit: options.limit ?? 100, after }
      })
    );
    items.push(...body.items);

    if (!body.pagination?.has_more_after || body.items.length === 0) return items;
    after = body.pagination.after ?? body.items.at(-1).id;
  }

  throw new Error(`${path} still had more pages after ${maxPages} pages`);
};

export interface AuthClientsSource {
  clients: { rest: RestClient; management: RestClient; instance: RestClient };
}

/** The standard credentials of a bootstrapped organization plus an unauthenticated client. */
export let authClients = <Extra extends Record<string, RestClient> = {}>(
  org: AuthClientsSource,
  extra: Extra = {} as Extra
) => ({
  none: rest(org.clients.rest.baseUrl),
  session: org.clients.rest,
  management: org.clients.management,
  instance: org.clients.instance,
  ...extra
});

/**
 * Sends the same request once per credential and asserts each status. Every mismatch is reported
 * together. `call` receives the credential name because dashboard, management and instance routes
 * use different path prefixes.
 */
export let expectAuthMatrix = async <Name extends string>(
  clients: Record<Name, RestClient>,
  call: (client: RestClient, name: Name) => Promise<RestResponse>,
  expected: Partial<Record<Name, number | number[]>>
) => {
  let mismatches: string[] = [];
  let responses = {} as Record<Name, RestResponse>;

  for (let [name, statuses] of Object.entries(expected) as [Name, number | number[]][]) {
    let response = await call(clients[name], name);
    responses[name] = response;

    let allowed = Array.isArray(statuses) ? statuses : [statuses];
    if (!allowed.includes(response.status)) {
      mismatches.push(
        `${name}: expected ${allowed.join(' or ')}, ${describeResponse(response)}`
      );
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`Auth matrix mismatches:\n${mismatches.join('\n')}`);
  }
  return responses;
};

let freeformKeys = new Set([
  'metadata',
  'config',
  'value',
  'data',
  'payload',
  'input',
  'output',
  'schema',
  'input_schema',
  'output_schema'
]);

/**
 * Asserts the public presenter conventions on a response body: the expected `object` type,
 * snake_case keys, and no leaked internal `oid` fields. Values under user-defined keys such as
 * `metadata` are not inspected.
 */
export let expectPresented = (body: any, object?: string) => {
  if (object !== undefined && body?.object !== object) {
    throw new Error(`Expected object "${object}", got ${JSON.stringify(body?.object)}`);
  }

  let problems: string[] = [];
  let walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object' || value instanceof Date) return;

    for (let [key, child] of Object.entries(value)) {
      let childPath = path ? `${path}.${key}` : key;
      if (key === 'oid' || key.endsWith('_oid') || key.endsWith('Oid')) {
        problems.push(`${childPath} leaks an internal oid`);
      } else if (/[A-Z]/.test(key)) {
        problems.push(`${childPath} is not snake_case`);
      }
      if (!freeformKeys.has(key)) walk(child, childPath);
    }
  };
  walk(body, '');

  if (problems.length > 0) {
    throw new Error(`Presenter shape problems:\n${problems.join('\n')}`);
  }
  return body;
};
