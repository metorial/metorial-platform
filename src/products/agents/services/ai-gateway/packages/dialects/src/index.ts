import { anthropicMessagesEncoding } from './anthropicMessages/encode';
import { parseAnthropicMessagesRequest } from './anthropicMessages/parse';
import type { Dialect, DialectAdapter } from './lib/types';
import { openaiChatEncoding } from './openaiChat/encode';
import { parseOpenAIChatRequest } from './openaiChat/parse';
import { openResponsesEncoding } from './openResponses/encode';
import { parseOpenResponsesRequest } from './openResponses/parse';

export let dialectAdapters: Record<Dialect, DialectAdapter> = {
  openai_chat: {
    dialect: 'openai_chat',
    parseRequest: body => parseOpenAIChatRequest(body),
    ...openaiChatEncoding
  },
  anthropic_messages: {
    dialect: 'anthropic_messages',
    parseRequest: (body, d) => parseAnthropicMessagesRequest(body, d),
    ...anthropicMessagesEncoding
  },
  open_responses: {
    dialect: 'open_responses',
    parseRequest: body => parseOpenResponsesRequest(body),
    ...openResponsesEncoding
  }
};

export { anthropicMessageId, anthropicUsage } from './anthropicMessages/encode';
export {
  createCollector,
  usageFromPart,
  type CollectedPart,
  type CollectedResponse
} from './lib/collect';
export { decodeProviderMetadata, encodeProviderMetadata } from './lib/envelope';
export {
  DialectRequestError,
  dialectErrorBody,
  invalidParam,
  isDialectRequestError,
  unsupportedParam,
  type GatewayError
} from './lib/errors';
export { effectiveFinish } from './lib/finish';
export { serializeSseEvent, sseHeaders } from './lib/sse';
export type {
  CallOptions,
  Dialect,
  DialectAdapter,
  ParsedRequest,
  ResponseContext,
  SseEvent,
  StreamEncoder
} from './lib/types';
export { openaiChatCompletionId, openaiChatUsage } from './openaiChat/encode';
export { openResponseId, openResponsesUsage } from './openResponses/encode';
