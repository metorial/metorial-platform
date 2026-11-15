import type { JSONRPCMessage, JSONRPCRequest } from '@modelcontextprotocol/sdk/types.js';
import { safeFetch } from '../../../lib/http/fetchSsrf';
import { parseJsonRpcError } from '../../../lib/remote/modernError';
import { safeParse } from '../../../lib/safeParse';
import { getBytes, getLines, getMessages } from '../../../lib/sse/parse';
import { HttpResponseError } from '../../utils/connectionError';
import { getStandardHeaders } from './headers';

let MAX_ERROR_BODY_LENGTH = 1000;

export interface StatelessPostOptions {
  url: string;
  request: JSONRPCRequest;
  headers: Record<string, string>;
  signal: AbortSignal;
  egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList | null;
  onMessage: (message: JSONRPCMessage) => unknown;
}

export type StatelessPostOutcome =
  | { type: 'completed' }
  | { type: 'aborted' }
  | { type: 'failed'; error: unknown; responseBody?: string };

export let postStatelessRequest = async (
  opts: StatelessPostOptions
): Promise<StatelessPostOutcome> => {
  try {
    let response = await safeFetch(opts.url, {
      method: 'POST',
      egressPolicy: opts.egressPolicy,
      signal: opts.signal,
      headers: {
        ...opts.headers,
        ...getStandardHeaders(opts.request),
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(opts.request)
    });

    if (response.status >= 400) {
      let body = (await response.text().catch(() => '')).slice(0, MAX_ERROR_BODY_LENGTH);
      let isAuthFailure = response.status == 401 || response.status == 403;
      let rpcError = response.status < 500 && !isAuthFailure ? parseJsonRpcError(body) : null;

      if (rpcError) {
        await opts.onMessage({ ...rpcError, id: opts.request.id } as JSONRPCMessage);
        return { type: 'completed' };
      }

      return {
        type: 'failed',
        error: new HttpResponseError(response.status, response.statusText, body),
        responseBody: body
      };
    }

    let contentType = response.headers.get('content-type') ?? '';

    if (contentType.startsWith('text/event-stream') && response.body) {
      let delivery: Promise<unknown> = Promise.resolve();

      await getBytes(
        response.body,
        getLines(
          getMessages(
            () => {},
            () => {},
            event => {
              let data = safeParse(event.data);
              if (!data || typeof data != 'object') return;

              delivery = delivery.then(() => opts.onMessage(data as JSONRPCMessage));
            }
          )
        )
      );

      await delivery;
      return { type: 'completed' };
    }

    let text = await response.text();
    let data = text ? safeParse(text) : null;
    let messages = Array.isArray(data) ? data : data ? [data] : [];

    for (let message of messages) await opts.onMessage(message as JSONRPCMessage);

    return { type: 'completed' };
  } catch (error) {
    if (opts.signal.aborted) return { type: 'aborted' };
    return { type: 'failed', error };
  }
};
