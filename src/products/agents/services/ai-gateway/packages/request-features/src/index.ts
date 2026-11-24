import { summarizeAnthropicMessages } from './dialects/anthropicMessages';
import { summarizeOpenaiChat } from './dialects/openaiChat';
import { summarizeOpenResponses } from './dialects/openResponses';
import type { RequestDialect, RequestSummary } from './lib/summary';
import { asRecord } from './lib/values';

export {
  estimateTokens,
  lastUserText,
  type RequestDialect,
  type RequestSummary,
  type ResponseFormat
} from './lib/summary';

let summarizers: Record<RequestDialect, (body: Record<string, unknown>) => RequestSummary> = {
  openai_chat: summarizeOpenaiChat,
  anthropic_messages: summarizeAnthropicMessages,
  open_responses: summarizeOpenResponses
};

export let summarizeRequest = (dialect: RequestDialect, body: unknown): RequestSummary =>
  summarizers[dialect](asRecord(body) ?? {});
