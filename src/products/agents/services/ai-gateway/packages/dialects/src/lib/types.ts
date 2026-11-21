import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import type { CollectedResponse } from './collect';
import type { GatewayError } from './errors';

export type Dialect = 'openai_chat' | 'anthropic_messages' | 'open_responses';

export type CallOptions = Omit<
  LanguageModelV4CallOptions,
  'abortSignal' | 'headers' | 'includeRawChunks'
>;

export type ParsedRequest = {
  dialect: Dialect;
  model: string;
  stream: boolean;
  options: CallOptions;

  // OpenAI Chat only sends usage in a stream when `stream_options.include_usage` is set.
  streamUsage: boolean;

  // Request fields some dialects echo back in their response objects (Open Responses).
  echo: Record<string, unknown>;
};

export type ResponseContext = {
  id: string;
  model: string;
  createdAt: Date;
};

export type SseEvent = { event?: string; data: string };

export type StreamEncoder = {
  push: (part: LanguageModelV4StreamPart) => SseEvent[];
  fail: (error: GatewayError) => SseEvent[];
};

export type DialectAdapter = {
  dialect: Dialect;
  parseRequest: (body: unknown, d?: { countTokens?: boolean }) => ParsedRequest;
  toResponse: (d: {
    collected: CollectedResponse;
    context: ResponseContext;
    request: ParsedRequest;
  }) => unknown;
  createStreamEncoder: (d: {
    context: ResponseContext;
    request: ParsedRequest;
  }) => StreamEncoder;
};
