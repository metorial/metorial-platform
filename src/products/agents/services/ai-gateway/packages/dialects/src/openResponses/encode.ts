import type { LanguageModelV4StreamPart, SharedV4ProviderMetadata } from '@ai-sdk/provider';
import type { GatewayUsage } from '@mtsrc/ai-gateway-spec';
import { usageFromPart, type CollectedPart } from '../lib/collect';
import { mergeProviderMetadata, openaiEncryptedContentFor } from '../lib/envelope';
import type { GatewayError } from '../lib/errors';
import { effectiveFinish, toUnixSeconds } from '../lib/finish';
import type { DialectAdapter, ParsedRequest, ResponseContext, SseEvent } from '../lib/types';

type Status = 'completed' | 'incomplete' | 'failed';

export let openResponsesUsage = (usage: GatewayUsage) => ({
  input_tokens: usage.input.total,
  input_tokens_details: { cached_tokens: usage.input.cacheRead },
  output_tokens: usage.output.total,
  output_tokens_details: { reasoning_tokens: usage.output.reasoning },
  total_tokens: usage.input.total + usage.output.total
});

export let openResponseId = (context: ResponseContext) => `resp_${context.id}`;

let incompleteReason = (unified: string) =>
  unified == 'length'
    ? 'max_output_tokens'
    : unified == 'content-filter'
      ? 'content_filter'
      : null;

let openaiItemId = (metadata: SharedV4ProviderMetadata | undefined) => {
  let id = metadata?.openai?.itemId ?? metadata?.azure?.itemId;
  return typeof id == 'string' ? id : null;
};

// OpenAI reasoning is a summary of hidden reasoning; everything else is the raw reasoning text.
let isSummary = (metadata: SharedV4ProviderMetadata | undefined) =>
  openaiItemId(metadata) !== null;

let responseObject = (d: {
  context: ResponseContext;
  request: ParsedRequest;
  status: Status | 'in_progress';
  output: unknown[];
  usage: GatewayUsage | null;
  incompleteReason?: string | null;
  error?: GatewayError;
  completedAt?: Date;
}) => {
  let echo = d.request.echo;

  return {
    id: openResponseId(d.context),
    object: 'response',
    created_at: toUnixSeconds(d.context.createdAt),
    completed_at: d.completedAt ? toUnixSeconds(d.completedAt) : null,
    status: d.status,
    incomplete_details: d.incompleteReason ? { reason: d.incompleteReason } : null,
    error: d.error ? { code: d.error.code, message: d.error.message } : null,
    model: d.context.model,
    output: d.output,
    usage: d.usage ? openResponsesUsage(d.usage) : null,
    instructions: echo.instructions ?? null,
    tools: echo.tools ?? [],
    tool_choice: echo.tool_choice ?? 'auto',
    parallel_tool_calls: echo.parallel_tool_calls ?? true,
    temperature: echo.temperature ?? null,
    top_p: echo.top_p ?? null,
    presence_penalty: echo.presence_penalty ?? 0,
    frequency_penalty: echo.frequency_penalty ?? 0,
    top_logprobs: 0,
    max_output_tokens: echo.max_output_tokens ?? null,
    max_tool_calls: null,
    previous_response_id: null,
    reasoning: echo.reasoning ?? null,
    text: echo.text ?? { format: { type: 'text' } },
    truncation: echo.truncation ?? 'disabled',
    metadata: echo.metadata ?? {},
    prompt_cache_key: echo.prompt_cache_key ?? null,
    safety_identifier: echo.safety_identifier ?? null,
    service_tier: echo.service_tier ?? 'default',
    user: echo.user ?? null,
    store: false,
    background: false
  };
};

let outputText = (text: string) => ({
  type: 'output_text',
  text,
  annotations: [],
  logprobs: []
});

let reasoningItem = (d: {
  id: string;
  texts: string[];
  metadata: SharedV4ProviderMetadata | undefined;
  status?: string;
}) => {
  let summary = isSummary(d.metadata);

  return {
    type: 'reasoning',
    id: d.id,
    summary: summary ? d.texts.map(text => ({ type: 'summary_text', text })) : [],
    ...(summary ? {} : { content: d.texts.map(text => ({ type: 'reasoning_text', text })) }),
    encrypted_content: openaiEncryptedContentFor(d.metadata),
    ...(d.status ? { status: d.status } : {})
  };
};

let functionCallItem = (d: {
  id: string;
  callId: string;
  name: string;
  args: string;
  status: string;
}) => ({
  type: 'function_call',
  id: d.id,
  call_id: d.callId,
  name: d.name,
  arguments: d.args,
  status: d.status
});

// Only the item that was being generated when the response stopped can be incomplete.
let collectedOutput = (
  content: CollectedPart[],
  context: ResponseContext,
  lastStatus: string
) => {
  let output: unknown[] = [];
  let counter = 0;
  let itemId = (prefix: string) => `${prefix}_${context.id}_${counter++}`;
  let lastText = content.findLastIndex(part => part.type == 'text' && part.text.length);

  for (let position = 0; position < content.length; position++) {
    let part = content[position]!;

    if (part.type == 'text') {
      if (!part.text.length) continue;
      output.push({
        type: 'message',
        id: itemId('msg'),
        status:
          position == lastText && position == content.length - 1 ? lastStatus : 'completed',
        role: 'assistant',
        content: [outputText(part.text)]
      });
      continue;
    }

    if (part.type == 'tool-call') {
      output.push(
        functionCallItem({
          id: itemId('fc'),
          callId: part.toolCallId,
          name: part.toolName,
          args: part.input,
          status: 'completed'
        })
      );
      continue;
    }

    let nativeId = openaiItemId(part.providerMetadata);
    let texts = [part.text];
    let metadata = part.providerMetadata;

    while (nativeId !== null) {
      let next = content[position + 1];
      if (next?.type != 'reasoning' || openaiItemId(next.providerMetadata) != nativeId) break;

      texts.push(next.text);
      metadata = mergeProviderMetadata(metadata, next.providerMetadata);
      position++;
    }

    output.push(
      reasoningItem({
        id: nativeId ?? itemId('rs'),
        texts: texts.filter(text => text.length),
        metadata
      })
    );
  }

  return output;
};

type OpenItem =
  | { kind: 'message'; partId: string; itemId: string; outputIndex: number; text: string }
  | {
      kind: 'reasoning';
      partIds: string[];
      itemId: string;
      outputIndex: number;
      nativeId: string | null;
      summary: boolean;
      texts: string[];
      partOpen: boolean;
      metadata?: SharedV4ProviderMetadata;
    }
  | {
      kind: 'function_call';
      callId: string;
      itemId: string;
      outputIndex: number;
      name: string;
      args: string;
    };

export let openResponsesEncoding: Pick<DialectAdapter, 'toResponse' | 'createStreamEncoder'> =
  {
    toResponse: ({ collected, context, request }) => {
      let reason = incompleteReason(effectiveFinish(collected));
      let status: Status = reason ? 'incomplete' : 'completed';

      return responseObject({
        context,
        request,
        status,
        output: collectedOutput(collected.content, context, status),
        usage: collected.usage,
        incompleteReason: reason,
        completedAt: new Date()
      });
    },

    createStreamEncoder: ({ context, request }) => {
      let sequence = 0;
      let started = false;
      let counter = 0;
      let output: unknown[] = [];
      let current: OpenItem | null = null;
      let streamedCalls = new Set<string>();

      let emit = (type: string, data: Record<string, unknown>): SseEvent => ({
        event: type,
        data: JSON.stringify({ type, sequence_number: sequence++, ...data })
      });

      let itemId = (prefix: string) => `${prefix}_${context.id}_${counter++}`;

      let start = (): SseEvent[] => {
        if (started) return [];
        started = true;

        let response = responseObject({
          context,
          request,
          status: 'in_progress',
          output: [],
          usage: null
        });
        return [
          emit('response.created', { response }),
          emit('response.in_progress', { response })
        ];
      };

      let closeReasoningPart = (
        item: Extract<OpenItem, { kind: 'reasoning' }>
      ): SseEvent[] => {
        if (!item.partOpen) return [];
        item.partOpen = false;

        let partIndex = item.texts.length - 1;
        let text = item.texts[partIndex]!;
        let base = { item_id: item.itemId, output_index: item.outputIndex };

        if (item.summary) {
          return [
            emit('response.reasoning_summary_text.done', {
              ...base,
              summary_index: partIndex,
              text
            }),
            emit('response.reasoning_summary_part.done', {
              ...base,
              summary_index: partIndex,
              part: { type: 'summary_text', text }
            })
          ];
        }

        return [
          emit('response.reasoning_text.done', { ...base, content_index: partIndex, text }),
          emit('response.content_part.done', {
            ...base,
            content_index: partIndex,
            part: { type: 'reasoning_text', text }
          })
        ];
      };

      let close = (status = 'completed'): SseEvent[] => {
        let item = current;
        if (!item) return [];
        current = null;

        let events: SseEvent[] = [];
        let done: unknown;

        if (item.kind == 'message') {
          let base = {
            item_id: item.itemId,
            output_index: item.outputIndex,
            content_index: 0
          };
          events.push(
            emit('response.output_text.done', { ...base, text: item.text, logprobs: [] }),
            emit('response.content_part.done', { ...base, part: outputText(item.text) })
          );
          done = {
            type: 'message',
            id: item.itemId,
            status,
            role: 'assistant',
            content: [outputText(item.text)]
          };
        } else if (item.kind == 'reasoning') {
          events.push(...closeReasoningPart(item));
          done = reasoningItem({
            id: item.itemId,
            texts: item.texts,
            metadata: item.metadata
          });
        } else {
          events.push(
            emit('response.function_call_arguments.done', {
              item_id: item.itemId,
              output_index: item.outputIndex,
              name: item.name,
              arguments: item.args
            })
          );
          done = functionCallItem({
            id: item.itemId,
            callId: item.callId,
            name: item.name,
            args: item.args,
            status: 'completed'
          });
        }

        output.push(done);
        events.push(
          emit('response.output_item.done', { output_index: item.outputIndex, item: done })
        );

        return events;
      };

      let openItem = <Item extends OpenItem>(
        build: (outputIndex: number) => { item: Item; added: unknown }
      ): { events: SseEvent[]; item: Item } => {
        let events = [...start(), ...close()];
        let { item, added } = build(output.length);
        current = item;
        events.push(
          emit('response.output_item.added', { output_index: item.outputIndex, item: added })
        );

        return { events, item };
      };

      let openMessage = (partId: string): SseEvent[] => {
        let id = itemId('msg');
        let { events, item } = openItem(outputIndex => ({
          item: { kind: 'message' as const, partId, itemId: id, outputIndex, text: '' },
          added: { type: 'message', id, status: 'in_progress', role: 'assistant', content: [] }
        }));
        events.push(
          emit('response.content_part.added', {
            item_id: id,
            output_index: item.outputIndex,
            content_index: 0,
            part: outputText('')
          })
        );

        return events;
      };

      let openReasoningPart = (
        item: Extract<OpenItem, { kind: 'reasoning' }>,
        partId: string
      ): SseEvent[] => {
        item.partIds.push(partId);
        item.texts.push('');
        item.partOpen = true;

        let partIndex = item.texts.length - 1;
        let base = { item_id: item.itemId, output_index: item.outputIndex };

        return item.summary
          ? [
              emit('response.reasoning_summary_part.added', {
                ...base,
                summary_index: partIndex,
                part: { type: 'summary_text', text: '' }
              })
            ]
          : [
              emit('response.content_part.added', {
                ...base,
                content_index: partIndex,
                part: { type: 'reasoning_text', text: '' }
              })
            ];
      };

      let startReasoning = (
        partId: string,
        metadata: SharedV4ProviderMetadata | undefined
      ): SseEvent[] => {
        let nativeId = openaiItemId(metadata);

        if (
          current?.kind == 'reasoning' &&
          nativeId !== null &&
          current.nativeId == nativeId
        ) {
          let item = current;
          item.metadata = mergeProviderMetadata(item.metadata, metadata);
          return [...closeReasoningPart(item), ...openReasoningPart(item, partId)];
        }

        let id = nativeId ?? itemId('rs');
        let summary = isSummary(metadata);
        let { events, item } = openItem(outputIndex => ({
          item: {
            kind: 'reasoning' as const,
            partIds: [] as string[],
            itemId: id,
            outputIndex,
            nativeId,
            summary,
            texts: [] as string[],
            partOpen: false,
            metadata
          },
          added: {
            type: 'reasoning',
            id,
            summary: [],
            ...(summary ? {} : { content: [] }),
            encrypted_content: null
          }
        }));
        events.push(...openReasoningPart(item, partId));

        return events;
      };

      let currentReasoning = (partId: string) =>
        current?.kind == 'reasoning' && current.partOpen && current.partIds.at(-1) == partId
          ? current
          : null;

      let openFunctionCall = (callId: string, name: string): SseEvent[] => {
        let id = itemId('fc');
        return openItem(outputIndex => ({
          item: {
            kind: 'function_call' as const,
            callId,
            itemId: id,
            outputIndex,
            name,
            args: ''
          },
          added: functionCallItem({ id, callId, name, args: '', status: 'in_progress' })
        })).events;
      };

      let argumentsDelta = (delta: string): SseEvent[] => {
        let item = current as Extract<OpenItem, { kind: 'function_call' }>;
        item.args += delta;

        return [
          emit('response.function_call_arguments.delta', {
            item_id: item.itemId,
            output_index: item.outputIndex,
            delta
          })
        ];
      };

      let push = (part: LanguageModelV4StreamPart): SseEvent[] => {
        switch (part.type) {
          case 'text-delta': {
            if (!part.delta) return [];

            let events =
              current?.kind == 'message' && current.partId == part.id
                ? []
                : openMessage(part.id);
            let item = current as Extract<OpenItem, { kind: 'message' }>;
            item.text += part.delta;
            events.push(
              emit('response.output_text.delta', {
                item_id: item.itemId,
                output_index: item.outputIndex,
                content_index: 0,
                delta: part.delta,
                logprobs: []
              })
            );

            return events;
          }

          case 'reasoning-start':
            return startReasoning(part.id, part.providerMetadata);

          case 'reasoning-delta': {
            let events = currentReasoning(part.id)
              ? []
              : startReasoning(part.id, part.providerMetadata);
            let item = current as Extract<OpenItem, { kind: 'reasoning' }>;
            item.metadata = mergeProviderMetadata(item.metadata, part.providerMetadata);
            if (!part.delta) return events;

            let partIndex = item.texts.length - 1;
            item.texts[partIndex] += part.delta;
            let base = { item_id: item.itemId, output_index: item.outputIndex };

            events.push(
              item.summary
                ? emit('response.reasoning_summary_text.delta', {
                    ...base,
                    summary_index: partIndex,
                    delta: part.delta
                  })
                : emit('response.reasoning_text.delta', {
                    ...base,
                    content_index: partIndex,
                    delta: part.delta
                  })
            );

            return events;
          }

          case 'reasoning-end': {
            let item = currentReasoning(part.id);
            if (!item) return [];

            item.metadata = mergeProviderMetadata(item.metadata, part.providerMetadata);
            return item.nativeId === null ? close() : closeReasoningPart(item);
          }

          case 'tool-input-start':
            if (part.providerExecuted) return [];

            streamedCalls.add(part.id);
            return openFunctionCall(part.id, part.toolName);

          case 'tool-input-delta':
            if (!part.delta || current?.kind != 'function_call' || current.callId != part.id)
              return [];
            return argumentsDelta(part.delta);

          case 'tool-call': {
            if (part.providerExecuted) return [];

            if (streamedCalls.has(part.toolCallId)) {
              if (current?.kind != 'function_call' || current.callId != part.toolCallId)
                return [];
              current.args = part.input;
              return close();
            }

            let events = openFunctionCall(part.toolCallId, part.toolName);
            if (part.input) events.push(...argumentsDelta(part.input));
            events.push(...close());

            return events;
          }

          case 'finish': {
            let sawToolCalls =
              streamedCalls.size > 0 ||
              output.some(item => (item as { type: string }).type == 'function_call');
            let unified =
              part.finishReason.unified == 'stop' && sawToolCalls
                ? 'tool-calls'
                : part.finishReason.unified;
            let reason = incompleteReason(unified);
            let status: Status = reason ? 'incomplete' : 'completed';

            let events = [...start(), ...close(status)];
            let response = responseObject({
              context,
              request,
              status,
              output,
              usage: usageFromPart(part),
              incompleteReason: reason,
              completedAt: new Date()
            });
            events.push(
              emit(status == 'completed' ? 'response.completed' : 'response.incomplete', {
                response
              })
            );

            return events;
          }

          default:
            return [];
        }
      };

      return {
        push,
        fail: error => [
          ...start(),
          emit('error', {
            code: error.code,
            message: error.message,
            param: error.param ?? null
          }),
          emit('response.failed', {
            response: responseObject({
              context,
              request,
              status: 'failed',
              output,
              usage: null,
              error
            })
          })
        ]
      };
    }
  };
