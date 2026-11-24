import {
  APICallError,
  type LanguageModelV4,
  type LanguageModelV4CallOptions,
  type LanguageModelV4FinishReason,
  type LanguageModelV4StreamPart,
  type LanguageModelV4Usage
} from '@ai-sdk/provider';
import { chunksOf, finishOf, usageOf, type Script, type ScriptFinish } from './script';

let unifiedFinish: Record<ScriptFinish, LanguageModelV4FinishReason['unified']> = {
  stop: 'stop',
  'stop-sequence': 'stop',
  length: 'length',
  'tool-calls': 'tool-calls',
  'content-filter': 'content-filter'
};

export let scriptUsage = (script: Script): LanguageModelV4Usage => {
  let usage = usageOf(script);

  return {
    inputTokens: {
      total: usage.input + usage.cacheRead + usage.cacheWrite,
      noCache: usage.input,
      cacheRead: usage.cacheRead,
      cacheWrite: usage.cacheWrite
    },
    outputTokens: {
      total: usage.output,
      text: usage.output - usage.reasoning,
      reasoning: usage.reasoning
    }
  };
};

export let scriptParts = (script: Script): LanguageModelV4StreamPart[] => {
  let parts: LanguageModelV4StreamPart[] = [
    { type: 'stream-start', warnings: [] },
    {
      type: 'response-metadata',
      id: script.id ?? 'mock-response',
      modelId: script.model ?? 'mock-model',
      timestamp: new Date(0)
    }
  ];

  script.steps.forEach((step, index) => {
    let id = `${index}`;

    if (step.type == 'text') {
      parts.push({ type: 'text-start', id });
      for (let delta of chunksOf(step.text, script.chunkSize)) {
        parts.push({ type: 'text-delta', id, delta });
      }
      parts.push({ type: 'text-end', id });
      return;
    }

    if (step.type == 'reasoning') {
      let providerMetadata =
        step.metadata ??
        (step.signature || step.redacted
          ? {
              mock: {
                ...(step.signature ? { signature: step.signature } : {}),
                ...(step.redacted ? { redactedData: step.redacted } : {})
              }
            }
          : undefined);

      let reasoningId = step.id ?? id;
      parts.push({
        type: 'reasoning-start',
        id: reasoningId,
        providerMetadata: step.startMetadata ?? (step.redacted ? providerMetadata : undefined)
      });
      if (!step.redacted) {
        for (let delta of chunksOf(step.text, script.chunkSize)) {
          parts.push({ type: 'reasoning-delta', id: reasoningId, delta });
        }
      }
      parts.push({ type: 'reasoning-end', id: reasoningId, providerMetadata });
      return;
    }

    let input = JSON.stringify(step.input);
    if (step.streamInput !== false) {
      parts.push({ type: 'tool-input-start', id: step.id, toolName: step.name });
      for (let delta of chunksOf(input, script.chunkSize ?? 8)) {
        parts.push({ type: 'tool-input-delta', id: step.id, delta });
      }
      parts.push({ type: 'tool-input-end', id: step.id });
    }
    parts.push({ type: 'tool-call', toolCallId: step.id, toolName: step.name, input });
  });

  if (script.failMidStream) {
    parts.push({ type: 'error', error: new Error(script.failMidStream.message) });
    return parts;
  }

  let finish = finishOf(script);
  parts.push({
    type: 'finish',
    usage: scriptUsage(script),
    providerMetadata: script.finishMetadata,
    finishReason: {
      unified: unifiedFinish[finish],
      raw: finish == 'stop-sequence' ? 'stop_sequence' : finish
    }
  });

  return parts;
};

export let apiCallError = (d: {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  url?: string;
}) =>
  new APICallError({
    message: `Upstream responded with ${d.status}`,
    url: d.url ?? 'https://upstream.test',
    requestBodyValues: {},
    statusCode: d.status,
    responseHeaders: d.headers,
    responseBody: d.body === undefined ? undefined : JSON.stringify(d.body),
    isRetryable: d.status == 408 || d.status == 409 || d.status == 429 || d.status >= 500
  });

let toStream = (parts: LanguageModelV4StreamPart[], signal?: AbortSignal) =>
  new ReadableStream<LanguageModelV4StreamPart>({
    async start(controller) {
      for (let part of parts) {
        if (signal?.aborted) {
          controller.error(signal.reason ?? new Error('aborted'));
          return;
        }

        controller.enqueue(part);
        await Promise.resolve();
      }

      controller.close();
    }
  });

export type MockModelScript = Script | ((options: LanguageModelV4CallOptions) => Script);

export type MockModel = LanguageModelV4 & { calls: LanguageModelV4CallOptions[] };

export let createMockModel = (
  script: MockModelScript | MockModelScript[],
  d: { provider?: string; modelId?: string } = {}
): MockModel => {
  let queue = Array.isArray(script) ? [...script] : [script];
  let calls: LanguageModelV4CallOptions[] = [];

  let next = (options: LanguageModelV4CallOptions) => {
    let entry = queue.length > 1 ? queue.shift()! : queue[0]!;
    return typeof entry == 'function' ? entry(options) : entry;
  };

  let doStream = async (options: LanguageModelV4CallOptions) => {
    calls.push(options);

    let resolved = next(options);
    if (resolved.httpError) {
      throw apiCallError({
        status: resolved.httpError.status,
        body: resolved.httpError.body,
        headers: resolved.httpError.headers
      });
    }

    return { stream: toStream(scriptParts(resolved), options.abortSignal) };
  };

  return {
    specificationVersion: 'v4',
    provider: d.provider ?? 'mock',
    modelId: d.modelId ?? 'mock-model',
    supportedUrls: { '*/*': [/^https?:\/\//] },
    calls,
    doStream,
    doGenerate: async () => {
      throw new Error('The gateway only calls doStream.');
    }
  };
};
