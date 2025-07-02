import qs from 'qs';
import { MetorialSDKError } from './error';

export interface MetorialRequest {
  path: string | string[];
  host?: string;
  query?: Record<string, any>;
  body?: Record<string, any> | FormData;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class MetorialEndpointManager<Config> {
  constructor(
    public readonly config: Config,
    public readonly apiHost: string,
    public readonly getHeaders: (config: Config) => Record<string, string>,
    public readonly fetchImpl: typeof fetch | undefined | null,
    private readonly options: {
      enableDebugLogging: boolean;
    }
  ) {}

  get fetch() {
    return this.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private async request(method: Method, request: MetorialRequest, tryCount = 0): Promise<any> {
    let path = Array.isArray(request.path) ? request.path.join('/') : request.path;
    let url = new URL(request.host ?? this.apiHost);
    url.pathname = url.pathname.replace(/\/$/, '') + '/' + path.replace(/^\//, '');

    if (request.query) {
      url.search = qs.stringify(request.query);
    }

    let headers = new Headers(this.getHeaders?.(this.config) ?? {});

    let hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
    if (hasBody) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.options.enableDebugLogging) {
      console.log(`[Metorial] ${method} ${url.toString()}`, {
        body: request.body,
        query: request.query
      });
    }

    let response: Response;
    try {
      response = await this.fetch(url.toString(), {
        method,
        headers,
        body: hasBody
          ? request.body instanceof FormData
            ? request.body
            : JSON.stringify(request.body ?? {})
          : undefined,
        credentials: 'include',
        redirect: 'follow',
        referrerPolicy: 'no-referrer-when-downgrade',
        cache: 'no-cache',
        keepalive: true,
        mode: 'cors'
      });

      // Re-try for too many requests
      if (response.status == 429 && tryCount < 3) {
        let retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          await new Promise(resolve => setTimeout(resolve, (parseInt(retryAfter) + 3) * 1000));
          return this.request(method, request);
        }
      }
    } catch (error) {
      if (this.options.enableDebugLogging) {
        console.error(`[Metorial] ${method} ${url.toString()}`, error);
      }

      throw new MetorialSDKError({
        status: 0,
        code: 'network_error',
        message: 'Unable to connect to Metorial API - please check your internet connection'
      });
    }

    let data: any;
    try {
      data = await response.json();
    } catch (error) {
      if (this.options.enableDebugLogging) {
        console.error(`[Metorial] ${method} ${url.toString()}`, error);
      }

      throw new MetorialSDKError({
        status: response.status,
        code: 'malformed_response',
        message: 'The Metorial API returned an unexpected response. Expected JSON.'
      });
    }

    if (!response.ok) {
      if (this.options.enableDebugLogging) {
        console.error(`[Metorial] ${method} ${url.toString()}`, data);
      }

      throw new MetorialSDKError(data);
    }

    if (this.options.enableDebugLogging) {
      console.log(`[Metorial] ${method} ${url.toString()}`, data);
    }

    return data;
  }

  private requestAndTransform(method: Method, request: MetorialRequest) {
    return {
      transform: async <T>(mapper: { transformFrom: (input: any) => T }): Promise<T> => {
        let data = await this.request(method, request);
        return mapper.transformFrom(data);
      }
    };
  }

  _get(request: MetorialRequest) {
    return this.requestAndTransform('GET', request);
  }

  _post(request: MetorialRequest) {
    return this.requestAndTransform('POST', request);
  }

  _put(request: MetorialRequest) {
    return this.requestAndTransform('PUT', request);
  }

  _patch(request: MetorialRequest) {
    return this.requestAndTransform('PATCH', request);
  }

  _delete(request: MetorialRequest) {
    return this.requestAndTransform('DELETE', request);
  }
}

export abstract class BaseMetorialEndpoint<Config> {
  constructor(protected readonly manager: MetorialEndpointManager<Config>) {}

  protected _get(request: MetorialRequest) {
    return this.manager._get(request);
  }

  protected _post(request: MetorialRequest) {
    return this.manager._post(request);
  }

  protected _put(request: MetorialRequest) {
    return this.manager._put(request);
  }

  protected _patch(request: MetorialRequest) {
    return this.manager._patch(request);
  }

  protected _delete(request: MetorialRequest) {
    return this.manager._delete(request);
  }
}
