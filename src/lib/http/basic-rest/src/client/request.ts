import { internalServerError, ServiceError } from '@lowerdeck/error';
import { typeToMethod } from '../types';

let defaultTypes = new Set(['get', 'list', 'create', 'update', 'delete']);

let isPlainObject = (value: any) =>
  !!value && typeof value == 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

let encodeQuery = (url: URL, query: Record<string, string | undefined>) => {
  for (let [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, value);
  }
};

let getInputQuery = (input: any): Record<string, string | undefined> => {
  if (input === undefined || input === null) return {};
  if (isPlainObject(input)) {
    return Object.fromEntries(
      Object.entries(input).flatMap(([key, value]) => {
        if (value === undefined || value === null) return [];
        return [[key, String(value)]];
      })
    );
  }

  return { input: String(input) };
};

export let request = async (opts: {
  endpoint: string;
  path: string[];
  payload: any;
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
}) => {
  let url = new URL(opts.endpoint);
  let path = [...opts.path];

  let operation = path.pop()!;
  let method = typeToMethod[operation as keyof typeof typeToMethod] ?? 'post';

  let isDefault = defaultTypes.has(operation);
  if (!isDefault) path.push(operation);

  url.pathname = `/${path.map(encodeURIComponent).join('/')}`;
  encodeQuery(url, opts.query ?? {});

  let body: string | undefined;
  if (method == 'get' || method == 'delete') {
    encodeQuery(url, getInputQuery(opts.payload?.input));
  } else {
    body = JSON.stringify(opts.payload ?? {});
  }

  let send = async (tryNo: number = 0): Promise<{
    data: any;
    status: number;
    headers: Record<string, string>;
  }> => {
    try {
      let res = await fetch(url.toString(), {
        method: method.toUpperCase(),
        headers: {
          ...Object.fromEntries(
            Object.entries(opts.headers).flatMap(([key, value]) =>
              value === undefined || value === null ? [] : [[key, value]]
            )
          ),
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body,
        credentials: 'include'
      });

      if (res.status >= 500) {
        if (tryNo < 5) {
          await new Promise(resolve => setTimeout(resolve, 2 ** tryNo * 1000));
          return await send(tryNo + 1);
        }
      }

      let text = await res.text();
      let payload = text ? JSON.parse(text) : null;
      let headers = Object.fromEntries(res.headers.entries());

      if (!res.ok) {
        if (payload && typeof payload == 'object') {
          throw ServiceError.fromResponse(payload as any);
        }

        throw new ServiceError(
          internalServerError({
            message:
              payload && typeof payload == 'object' && typeof payload.message == 'string'
                ? payload.message
                : `Request failed with status ${res.status}`
          })
        );
      }

      return {
        data: payload,
        status: res.status,
        headers
      };
    } catch (err: any) {
      if (err instanceof ServiceError) throw err;

      throw new ServiceError(
        internalServerError({
          message: err?.message ?? 'Unable to reach server',
          inner:
            typeof err == 'object'
              ? {
                  message: err?.message,
                  stack: err?.stack
                }
              : { error: err }
        })
      );
    }
  };

  return await send();
};
