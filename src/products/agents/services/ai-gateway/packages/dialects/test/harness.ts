import Anthropic from '@anthropic-ai/sdk';
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import {
  createMockModel,
  parseSse,
  type MockModelScript,
  type ParsedSseEvent
} from '@mtsrc/ai-gateway-testing';
import OpenAI from 'openai';
import {
  createCollector,
  dialectAdapters,
  dialectErrorBody,
  isDialectRequestError,
  serializeSseEvent,
  sseHeaders,
  type Dialect,
  type GatewayError,
  type ParsedRequest,
  type ResponseContext
} from '../src';

export let context: ResponseContext = {
  id: 'test',
  model: 'gateway/test-model',
  createdAt: new Date(1_700_000_000_000)
};

export let streamFailure: GatewayError = {
  status: 502,
  code: 'upstream_error',
  message: 'The upstream provider failed mid-stream.'
};

let readParts = async (stream: ReadableStream<LanguageModelV4StreamPart>) => {
  let parts: LanguageModelV4StreamPart[] = [];
  let reader = stream.getReader();

  while (true) {
    let next = await reader.read();
    if (next.done) return parts;
    parts.push(next.value);
  }
};

export type DialectRun = {
  request: ParsedRequest;
  call: LanguageModelV4CallOptions;
  parts: LanguageModelV4StreamPart[];
  response?: any;
  events?: ParsedSseEvent[];
  raw?: string;
};

// Runs one request through a dialect the way the gateway does: parse, stream from the model,
// then either encode the stream or collect it and build the non-streaming response.
export let runDialect = async (d: {
  dialect: Dialect;
  body: unknown;
  script: MockModelScript | MockModelScript[];
}): Promise<DialectRun> => {
  let adapter = dialectAdapters[d.dialect];
  let request = adapter.parseRequest(d.body);
  let model = createMockModel(d.script);
  let { stream } = await model.doStream(request.options);
  let parts = await readParts(stream);
  let call = model.calls[0]!;

  if (request.stream) {
    let encoder = adapter.createStreamEncoder({ context, request });
    let events = parts.flatMap(part =>
      part.type == 'error' ? encoder.fail(streamFailure) : encoder.push(part)
    );
    let raw = events.map(serializeSseEvent).join('');

    return { request, call, parts, raw, events: parseSse(raw) };
  }

  let collector = createCollector();
  parts.forEach(part => collector.push(part));

  return {
    request,
    call,
    parts,
    response: adapter.toResponse({ collected: collector.result(), context, request })
  };
};

export let parse = (dialect: Dialect, body: unknown) =>
  dialectAdapters[dialect].parseRequest(body);

export let parseError = (dialect: Dialect, body: unknown) => {
  try {
    dialectAdapters[dialect].parseRequest(body);
  } catch (error) {
    if (isDialectRequestError(error)) return error.toGatewayError();
    throw error;
  }

  throw new Error('Expected the request to be rejected.');
};

// A fetch that serves the gateway's dialect handling in-process, so the official SDKs can be
// pointed at it and parse our responses with their own (strict) accumulators.
export let gatewayFetch = (
  dialect: Dialect,
  scriptFor: (body: any) => MockModelScript | MockModelScript[]
) => {
  let bodies: any[] = [];
  let runs: DialectRun[] = [];

  let fetch = async (_input: unknown, init?: RequestInit) => {
    let body = JSON.parse(String(init?.body));
    bodies.push(body);

    try {
      let run = await runDialect({ dialect, body, script: scriptFor(body) });
      runs.push(run);
      if (run.raw !== undefined) {
        return new Response(run.raw, { status: 200, headers: sseHeaders });
      }

      return Response.json(run.response);
    } catch (error) {
      if (!isDialectRequestError(error)) throw error;

      let gatewayError = error.toGatewayError();
      return Response.json(dialectErrorBody(dialect, gatewayError), {
        status: gatewayError.status
      });
    }
  };

  return { fetch: fetch as typeof globalThis.fetch, bodies, runs };
};

export let openaiClient = (fetch: typeof globalThis.fetch) =>
  new OpenAI({ apiKey: 'test', baseURL: 'http://gateway.test/v1', fetch, maxRetries: 0 });

export let anthropicClient = (fetch: typeof globalThis.fetch) =>
  new Anthropic({ apiKey: 'test', baseURL: 'http://gateway.test', fetch, maxRetries: 0 });
