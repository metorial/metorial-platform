import type { LanguageModelV4StreamPart, SharedV4ProviderMetadata } from '@ai-sdk/provider';
import type { GatewayUsage } from '@mtsrc/ai-gateway-spec';
import type { CollectedPart } from '../lib/collect';
import {
  anthropicRedactedData,
  encodeProviderMetadata,
  mergeProviderMetadata
} from '../lib/envelope';
import { dialectErrorBody } from '../lib/errors';
import { effectiveFinish, toUnixSeconds } from '../lib/finish';
import { usageFromPart } from '../lib/collect';
import type { DialectAdapter, ResponseContext, SseEvent } from '../lib/types';

let finishReasons: Record<string, string> = {
  stop: 'stop',
  length: 'length',
  'tool-calls': 'tool_calls',
  'content-filter': 'content_filter'
};

let finishReasonOf = (unified: string) => finishReasons[unified] ?? 'stop';

export let openaiChatUsage = (usage: GatewayUsage) => ({
  prompt_tokens: usage.input.total,
  completion_tokens: usage.output.total,
  total_tokens: usage.input.total + usage.output.total,
  prompt_tokens_details: { cached_tokens: usage.input.cacheRead },
  completion_tokens_details: { reasoning_tokens: usage.output.reasoning }
});

let reasoningDetail = (text: string, metadata: SharedV4ProviderMetadata | undefined) => {
  if (anthropicRedactedData(metadata) !== null) {
    return { type: 'reasoning.encrypted', data: encodeProviderMetadata(metadata)! };
  }

  let signature = encodeProviderMetadata(metadata);
  return signature ? { type: 'reasoning.text', text, signature } : null;
};

let assistantMessage = (content: CollectedPart[]) => {
  let text = content.flatMap(part => (part.type == 'text' ? [part.text] : [])).join('');
  let reasoning = content.filter(part => part.type == 'reasoning');
  let toolCalls = content.flatMap(part =>
    part.type == 'tool-call'
      ? [
          {
            id: part.toolCallId,
            type: 'function',
            function: { name: part.toolName, arguments: part.input }
          }
        ]
      : []
  );

  let reasoningText = reasoning.map(part => part.text).join('');
  let details = reasoning.flatMap(part => {
    let detail = reasoningDetail(part.text, part.providerMetadata);
    return detail ? [detail] : [];
  });

  return {
    role: 'assistant',
    content: text.length || !toolCalls.length ? text : null,
    refusal: null,
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    ...(reasoningText.length ? { reasoning_content: reasoningText } : {}),
    ...(details.length ? { reasoning_details: details } : {})
  };
};

let sse = (data: unknown): SseEvent => ({ data: JSON.stringify(data) });

export let openaiChatCompletionId = (context: ResponseContext) => `chatcmpl-${context.id}`;

export let openaiChatEncoding: Pick<DialectAdapter, 'toResponse' | 'createStreamEncoder'> = {
  toResponse: ({ collected, context }) => ({
    id: openaiChatCompletionId(context),
    object: 'chat.completion',
    created: toUnixSeconds(context.createdAt),
    model: context.model,
    system_fingerprint: null,
    choices: [
      {
        index: 0,
        message: assistantMessage(collected.content),
        logprobs: null,
        finish_reason: finishReasonOf(effectiveFinish(collected))
      }
    ],
    usage: openaiChatUsage(collected.usage)
  }),

  createStreamEncoder: ({ context, request }) => {
    let started = false;
    let toolIndexes = new Map<string, number>();
    let reasoning = new Map<string, { text: string; metadata?: SharedV4ProviderMetadata }>();
    let sawToolCalls = false;

    let chunk = (delta: Record<string, unknown>, finishReason: string | null = null) =>
      sse({
        id: openaiChatCompletionId(context),
        object: 'chat.completion.chunk',
        created: toUnixSeconds(context.createdAt),
        model: context.model,
        system_fingerprint: null,
        choices: [{ index: 0, delta, logprobs: null, finish_reason: finishReason }]
      });

    let start = (): SseEvent[] => {
      if (started) return [];
      started = true;

      return [chunk({ role: 'assistant', content: '', refusal: null })];
    };

    let push = (part: LanguageModelV4StreamPart): SseEvent[] => {
      switch (part.type) {
        case 'text-delta':
          if (!part.delta) return [];
          return [...start(), chunk({ content: part.delta })];

        case 'reasoning-start':
        case 'reasoning-delta': {
          let entry = reasoning.get(part.id) ?? { text: '' };
          entry.metadata = mergeProviderMetadata(entry.metadata, part.providerMetadata);
          reasoning.set(part.id, entry);

          if (part.type == 'reasoning-start' || !part.delta) return start();

          entry.text += part.delta;
          return [...start(), chunk({ reasoning_content: part.delta })];
        }

        case 'reasoning-end': {
          let entry = reasoning.get(part.id) ?? { text: '' };
          reasoning.delete(part.id);

          let detail = reasoningDetail(
            entry.text,
            mergeProviderMetadata(entry.metadata, part.providerMetadata)
          );
          return detail ? [...start(), chunk({ reasoning_details: [detail] })] : [];
        }

        case 'tool-input-start': {
          if (part.providerExecuted) return [];

          sawToolCalls = true;
          let position = toolIndexes.size;
          toolIndexes.set(part.id, position);

          return [
            ...start(),
            chunk({
              tool_calls: [
                {
                  index: position,
                  id: part.id,
                  type: 'function',
                  function: { name: part.toolName, arguments: '' }
                }
              ]
            })
          ];
        }

        case 'tool-input-delta': {
          let position = toolIndexes.get(part.id);
          if (position === undefined || !part.delta) return [];

          return [
            chunk({ tool_calls: [{ index: position, function: { arguments: part.delta } }] })
          ];
        }

        case 'tool-call': {
          if (part.providerExecuted || toolIndexes.has(part.toolCallId)) return [];

          sawToolCalls = true;
          let position = toolIndexes.size;
          toolIndexes.set(part.toolCallId, position);

          return [
            ...start(),
            chunk({
              tool_calls: [
                {
                  index: position,
                  id: part.toolCallId,
                  type: 'function',
                  function: { name: part.toolName, arguments: part.input }
                }
              ]
            })
          ];
        }

        case 'finish': {
          let unified =
            part.finishReason.unified == 'stop' && sawToolCalls
              ? 'tool-calls'
              : part.finishReason.unified;

          let events = [...start(), chunk({}, finishReasonOf(unified))];
          if (request.streamUsage) {
            events.push(
              sse({
                id: openaiChatCompletionId(context),
                object: 'chat.completion.chunk',
                created: toUnixSeconds(context.createdAt),
                model: context.model,
                system_fingerprint: null,
                choices: [],
                usage: openaiChatUsage(usageFromPart(part))
              })
            );
          }

          events.push({ data: '[DONE]' });
          return events;
        }

        default:
          return [];
      }
    };

    return {
      push,
      fail: error => [sse(dialectErrorBody('openai_chat', error))]
    };
  }
};
