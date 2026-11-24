import type {
  LanguageModelV4FinishReason,
  LanguageModelV4StreamPart,
  SharedV4ProviderMetadata
} from '@ai-sdk/provider';
import type { GatewayUsage } from '@mtsrc/ai-gateway-spec';
import { usageFromPart, type CollectedPart } from '../lib/collect';
import {
  anthropicRedactedData,
  anthropicSignatureFor,
  encodeProviderMetadata,
  mergeProviderMetadata
} from '../lib/envelope';
import { dialectErrorBody } from '../lib/errors';
import { effectiveFinish } from '../lib/finish';
import type { DialectAdapter, ResponseContext, SseEvent } from '../lib/types';

let passthroughStopReasons = [
  'stop_sequence',
  'refusal',
  'pause_turn',
  'model_context_window_exceeded'
];

let stopReasonOf = (unified: string, raw: string | undefined) => {
  if (raw && passthroughStopReasons.includes(raw)) return raw;
  if (unified == 'length') return 'max_tokens';
  if (unified == 'tool-calls') return 'tool_use';
  if (unified == 'content-filter') return 'refusal';

  return 'end_turn';
};

let stopSequenceOf = (metadata: SharedV4ProviderMetadata | undefined) => {
  let value = metadata?.anthropic?.stopSequence;
  return typeof value == 'string' ? value : null;
};

export let anthropicUsage = (usage: GatewayUsage) => ({
  input_tokens: usage.input.noCache,
  output_tokens: usage.output.total,
  cache_creation_input_tokens: usage.input.cacheWrite,
  cache_read_input_tokens: usage.input.cacheRead
});

export let anthropicMessageId = (context: ResponseContext) => `msg_${context.id}`;

let toolInput = (input: string): unknown => {
  if (!input.trim()) return {};

  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
};

let redactedBlockData = (metadata: SharedV4ProviderMetadata | undefined) => {
  let native = anthropicRedactedData(metadata);
  if (native === null) return null;

  let onlyNative = Object.entries(metadata ?? {}).every(
    ([namespace, value]) =>
      !Object.keys(value).length ||
      (namespace == 'anthropic' && Object.keys(value).every(field => field == 'redactedData'))
  );

  return onlyNative ? native : encodeProviderMetadata(metadata)!;
};

let contentBlock = (part: CollectedPart) => {
  if (part.type == 'text') return { type: 'text', text: part.text };

  if (part.type == 'reasoning') {
    let redacted = redactedBlockData(part.providerMetadata);
    if (redacted !== null) return { type: 'redacted_thinking', data: redacted };

    return {
      type: 'thinking',
      thinking: part.text,
      signature: anthropicSignatureFor(part.providerMetadata)
    };
  }

  return {
    type: 'tool_use',
    id: part.toolCallId,
    name: part.toolName,
    input: toolInput(part.input)
  };
};

let event = (type: string, data: Record<string, unknown>): SseEvent => ({
  event: type,
  data: JSON.stringify({ type, ...data })
});

type OpenBlock =
  | { kind: 'text'; id: string; index: number }
  | { kind: 'thinking'; id: string; index: number; metadata?: SharedV4ProviderMetadata }
  | { kind: 'redacted'; id: string; index: number }
  | { kind: 'tool'; id: string; index: number };

type BlockInit = OpenBlock extends infer Block
  ? Block extends OpenBlock
    ? Omit<Block, 'index'>
    : never
  : never;

export let anthropicMessagesEncoding: Pick<
  DialectAdapter,
  'toResponse' | 'createStreamEncoder'
> = {
  toResponse: ({ collected, context }) => ({
    id: anthropicMessageId(context),
    type: 'message',
    role: 'assistant',
    model: context.model,
    content: collected.content
      .filter(part => part.type != 'text' || part.text.length)
      .map(contentBlock),
    stop_reason: stopReasonOf(effectiveFinish(collected), collected.finishReason.raw),
    stop_sequence: stopSequenceOf(collected.providerMetadata),
    stop_details: null,
    usage: anthropicUsage(collected.usage)
  }),

  createStreamEncoder: ({ context }) => {
    let started = false;
    let nextIndex = 0;
    let current: OpenBlock | null = null;
    let streamedTools = new Set<string>();
    let sawToolCalls = false;

    let start = (): SseEvent[] => {
      if (started) return [];
      started = true;

      return [
        event('message_start', {
          message: {
            id: anthropicMessageId(context),
            type: 'message',
            role: 'assistant',
            model: context.model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0
            }
          }
        })
      ];
    };

    let close = (): SseEvent[] => {
      if (!current) return [];

      let events: SseEvent[] = [];
      if (current.kind == 'thinking') {
        let signature = anthropicSignatureFor(current.metadata);
        if (signature) {
          events.push(
            event('content_block_delta', {
              index: current.index,
              delta: { type: 'signature_delta', signature }
            })
          );
        }
      }

      events.push(event('content_block_stop', { index: current.index }));
      current = null;

      return events;
    };

    let open = (block: BlockInit, contentBlock: Record<string, unknown>) => {
      let events = [...start(), ...close()];
      let index = nextIndex++;
      current = { ...block, index };
      events.push(event('content_block_start', { index, content_block: contentBlock }));

      return events;
    };

    let isCurrent = (kind: OpenBlock['kind'], id: string) =>
      current?.kind == kind && current.id == id;

    let delta = (delta: Record<string, unknown>) =>
      event('content_block_delta', { index: current!.index, delta });

    let push = (part: LanguageModelV4StreamPart): SseEvent[] => {
      switch (part.type) {
        case 'text-delta': {
          if (!part.delta) return [];

          let events = isCurrent('text', part.id)
            ? []
            : open({ kind: 'text', id: part.id }, { type: 'text', text: '' });
          events.push(delta({ type: 'text_delta', text: part.delta }));
          return events;
        }

        case 'text-end':
          return isCurrent('text', part.id) ? close() : [];

        case 'reasoning-start': {
          let redacted = redactedBlockData(part.providerMetadata);
          if (redacted !== null) {
            return open(
              { kind: 'redacted', id: part.id },
              { type: 'redacted_thinking', data: redacted }
            );
          }

          return open(
            { kind: 'thinking', id: part.id, metadata: part.providerMetadata },
            { type: 'thinking', thinking: '', signature: '' }
          );
        }

        case 'reasoning-delta': {
          if (isCurrent('redacted', part.id)) return [];

          let events = isCurrent('thinking', part.id)
            ? []
            : open(
                { kind: 'thinking', id: part.id },
                { type: 'thinking', thinking: '', signature: '' }
              );

          let block = current as Extract<OpenBlock, { kind: 'thinking' }>;
          block.metadata = mergeProviderMetadata(block.metadata, part.providerMetadata);
          if (part.delta) events.push(delta({ type: 'thinking_delta', thinking: part.delta }));

          return events;
        }

        case 'reasoning-end': {
          if (isCurrent('thinking', part.id)) {
            let block = current as Extract<OpenBlock, { kind: 'thinking' }>;
            block.metadata = mergeProviderMetadata(block.metadata, part.providerMetadata);
            return close();
          }

          return isCurrent('redacted', part.id) ? close() : [];
        }

        case 'tool-input-start': {
          if (part.providerExecuted) return [];

          sawToolCalls = true;
          streamedTools.add(part.id);
          return open(
            { kind: 'tool', id: part.id },
            { type: 'tool_use', id: part.id, name: part.toolName, input: {} }
          );
        }

        case 'tool-input-delta':
          if (!part.delta || !isCurrent('tool', part.id)) return [];
          return [delta({ type: 'input_json_delta', partial_json: part.delta })];

        case 'tool-call': {
          if (part.providerExecuted) return [];

          if (streamedTools.has(part.toolCallId)) {
            return isCurrent('tool', part.toolCallId) ? close() : [];
          }

          sawToolCalls = true;
          let events = open(
            { kind: 'tool', id: part.toolCallId },
            { type: 'tool_use', id: part.toolCallId, name: part.toolName, input: {} }
          );
          if (part.input.trim())
            events.push(delta({ type: 'input_json_delta', partial_json: part.input }));
          events.push(...close());

          return events;
        }

        case 'finish': {
          let finishReason: LanguageModelV4FinishReason = part.finishReason;
          let unified =
            finishReason.unified == 'stop' && sawToolCalls
              ? 'tool-calls'
              : finishReason.unified;

          return [
            ...start(),
            ...close(),
            event('message_delta', {
              delta: {
                stop_reason: stopReasonOf(unified, finishReason.raw),
                stop_sequence: stopSequenceOf(part.providerMetadata),
                stop_details: null
              },
              usage: anthropicUsage(usageFromPart(part))
            }),
            event('message_stop', {})
          ];
        }

        default:
          return [];
      }
    };

    return {
      push,
      fail: error => {
        let body = dialectErrorBody('anthropic_messages', error);
        return [{ event: 'error', data: JSON.stringify(body) }];
      }
    };
  }
};
