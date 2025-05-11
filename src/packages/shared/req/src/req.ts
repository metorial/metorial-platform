export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options';
export type BodyType = 'json' | 'form' | 'text' | 'urlencoded' | 'raw';

export interface RequestOptions {
  body?: any;
  headers?: Record<string, string | undefined>;
  query?: Record<string, string | number | undefined>;
  bodyType?: 'json' | 'form' | 'text' | 'urlencoded' | 'raw';
  responseType?: 'json' | 'text' | 'raw'; // default is json
}

export class RequestError extends Error {
  constructor(
    public message: string,
    public status: number,
    public response: Response,
    public data: any
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

let serializeQuery = (query: Record<string, string | number | undefined>) => {
  let params = new URLSearchParams();

  for (let [key, value] of Object.entries(query)) {
    if (value !== undefined) params.append(key, String(value));
  }

  return params.toString();
};

let serializeHeaders = (headers: Record<string, string | undefined>) => {
  let obj = new Headers();

  for (let [key, value] of Object.entries(headers)) {
    if (value !== undefined) obj.append(key, value);
  }

  return obj;
};

let serializeBody = (body: any, bodyType: string) => {
  let fetchBody: BodyInit | undefined;
  let headers: Record<string, string | undefined> = {};

  switch (bodyType) {
    case 'json':
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      fetchBody = body !== undefined ? JSON.stringify(body) : undefined;
      break;

    case 'form':
      const formData = new FormData();
      for (const key in body) {
        formData.append(key, body[key]);
      }
      fetchBody = formData;
      break;

    case 'text':
      headers['Content-Type'] = headers['Content-Type'] ?? 'text/plain';
      fetchBody = body;
      break;

    case 'urlencoded':
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/x-www-form-urlencoded';
      fetchBody = new URLSearchParams(body).toString();
      break;

    case 'raw':
      fetchBody = body;
      break;
  }

  return {
    fetchBody,
    headers
  };
};

export let request = async (
  method: Method,
  url: string,
  opts: RequestOptions = {}
): Promise<any> => {
  let u = new URL(url);
  u.search = `?${serializeQuery(opts.query ?? {})}`;

  let bodyRes = serializeBody(opts.body, opts.bodyType ?? 'json');
  let headers = serializeHeaders({
    'User-Agent': 'Metorial MCP Lambdas (https://github.com/metorial/mcp-lambdas)',

    ...opts.headers,
    ...bodyRes.headers
  });

  try {
    let res = await fetch(u, {
      method: method.toUpperCase(),
      headers,
      body: ['get', 'head', 'options'].includes(method) ? undefined : bodyRes.fetchBody
    });

    let data: any;
    if (!opts.responseType) {
      let contentType = res.headers.get('Content-Type');

      if (contentType?.includes('application/json')) {
        opts.responseType = 'json';
      } else if (contentType?.includes('text/')) {
        opts.responseType = 'text';
      }
    }

    if (opts.responseType === 'json') {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else if (opts.responseType === 'text') {
      data = await res.text();
    } else {
      data = res.body;
    }

    if (!res.ok) {
      throw new RequestError(`HTTP error: ${res.status}`, res.status, res, data);
    }

    return data;
  } catch (err: any) {
    if (err instanceof RequestError) {
      throw err;
    }

    throw new RequestError(err.message ?? 'Request failed', 0, {} as Response, null);
  }
};

export let req = {
  get: (url: string, opts: RequestOptions = {}) => request('get', url, opts),
  post: (url: string, body: any, opts: RequestOptions = {}) =>
    request('post', url, { ...opts, body }),
  put: (url: string, body: any, opts: RequestOptions = {}) =>
    request('put', url, { ...opts, body }),
  delete: (url: string, opts: RequestOptions = {}) => request('delete', url, opts),
  patch: (url: string, body: any, opts: RequestOptions = {}) =>
    request('patch', url, { ...opts, body }),

  custom: request
};
