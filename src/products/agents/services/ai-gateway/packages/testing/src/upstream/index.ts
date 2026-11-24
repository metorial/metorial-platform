import type { Script } from '../script';
import { anthropicEvents } from './anthropic';
import { cohereEvents } from './cohere';
import { googleEvents } from './google';
import { openaiChatEvents } from './openaiChat';
import { openaiResponsesEvents } from './openaiResponses';
import { sseResponse, type WireEvent } from './sse';

export type Wire =
  | 'openai-responses'
  | 'openai-chat'
  | 'anthropic-messages'
  | 'anthropic-count-tokens'
  | 'google-generate'
  | 'cohere-chat';

export type RecordedRequest = {
  wire: Wire;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
};

export type UpstreamResponder = (request: RecordedRequest) => Script | Promise<Script>;

let wireOf = (url: URL): Wire | null => {
  let path = url.pathname;

  if (path.endsWith('/messages/count_tokens')) return 'anthropic-count-tokens';
  if (path.endsWith('/messages')) return 'anthropic-messages';
  if (path.endsWith('/responses')) return 'openai-responses';
  if (path.endsWith('/chat/completions')) return 'openai-chat';
  if (path.includes(':streamGenerateContent') || path.includes(':generateContent')) {
    return 'google-generate';
  }
  if (url.hostname == 'api.cohere.com' && path.endsWith('/chat')) return 'cohere-chat';

  return null;
};

let isStreamingRequest = (wire: Wire, url: URL, body: any) => {
  if (wire == 'google-generate') return url.pathname.includes(':streamGenerateContent');
  if (wire == 'anthropic-count-tokens') return true;
  return body?.stream === true;
};

let eventsFor = (wire: Wire, script: Script, request: RecordedRequest): WireEvent[] => {
  let model = script.model ?? request.body?.model ?? 'fake-model';

  if (wire == 'openai-responses') return openaiResponsesEvents(script, model);
  if (wire == 'anthropic-messages') return anthropicEvents(script, model);
  if (wire == 'google-generate') return googleEvents(script, model);
  if (wire == 'cohere-chat') return cohereEvents(script);

  let host = new URL(request.url).hostname;

  return openaiChatEvents(script, model, {
    reasoningField:
      host == 'api.groq.com'
        ? 'reasoning'
        : host == 'api.mistral.ai'
          ? 'thinking_content'
          : 'reasoning_content',
    usageStyle:
      host == 'api.groq.com' ? 'x_groq' : host == 'api.mistral.ai' ? 'inline' : 'trailing'
  });
};

let readHeaders = (headers: HeadersInit | undefined) => {
  let result: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => {
    result[key] = value;
  });

  return result;
};

let readBody = async (body: BodyInit | null | undefined) => {
  if (body == null) return undefined;

  let text = typeof body == 'string' ? body : await new Response(body).text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

// A stand-in for every vendor API the gateway talks to. It answers with each vendor's real
// streaming wire format, so tests exercise the actual AI SDK providers end to end.
export let createFakeUpstream = (
  responder: UpstreamResponder | Script,
  d: { fragmentBytes?: number; countTokens?: number } = {}
) => {
  let requests: RecordedRequest[] = [];
  let respond = typeof responder == 'function' ? responder : () => responder;

  let fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let request = input instanceof Request ? input : null;
    let url = new URL(request ? request.url : input.toString());
    let wire = wireOf(url);

    let recorded: RecordedRequest = {
      wire: wire ?? 'openai-chat',
      url: url.toString(),
      method: init?.method ?? request?.method ?? 'GET',
      headers: readHeaders(init?.headers ?? request?.headers),
      body: await readBody(init?.body ?? (request ? await request.text() : undefined))
    };
    requests.push(recorded);

    if (!wire) {
      return Response.json({ error: { message: `No fake for ${url}` } }, { status: 404 });
    }

    if (!isStreamingRequest(wire, url, recorded.body)) {
      return Response.json(
        { error: { message: 'The gateway must always stream from upstream.' } },
        { status: 400 }
      );
    }

    if (wire == 'anthropic-count-tokens') {
      return Response.json({ input_tokens: d.countTokens ?? 42 });
    }

    let script = await respond(recorded);
    if (script.httpError) {
      return Response.json(script.httpError.body, {
        status: script.httpError.status,
        headers: script.httpError.headers
      });
    }

    return sseResponse(eventsFor(wire, script, recorded), { fragmentBytes: d.fragmentBytes });
  }) as typeof fetch;

  return { fetch: fakeFetch, requests };
};

export { sseResponse, type WireEvent } from './sse';
