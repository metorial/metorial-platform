import type {
  LanguageModelV4FinishReason,
  LanguageModelV4StreamPart,
  SharedV4ProviderMetadata,
  SharedV4Warning
} from '@ai-sdk/provider';
import { normalizeUsage } from '@mtsrc/ai-gateway-cost';
import { emptyUsage, type GatewayUsage } from '@mtsrc/ai-gateway-spec';
import { mergeProviderMetadata } from './envelope';

export type CollectedPart =
  | { type: 'text'; text: string; providerMetadata?: SharedV4ProviderMetadata }
  | { type: 'reasoning'; text: string; providerMetadata?: SharedV4ProviderMetadata }
  | {
      type: 'tool-call';
      toolCallId: string;
      toolName: string;
      input: string;
      providerMetadata?: SharedV4ProviderMetadata;
    };

export type CollectedResponse = {
  responseId?: string;
  modelId?: string;
  content: CollectedPart[];
  finishReason: LanguageModelV4FinishReason;
  usage: GatewayUsage;
  finished: boolean;
  providerMetadata?: SharedV4ProviderMetadata;
  warnings: SharedV4Warning[];
};

export let usageFromPart = (part: Extract<LanguageModelV4StreamPart, { type: 'finish' }>) =>
  normalizeUsage(part.usage);

// Folds a stream into the same content a non-streaming call would have returned. Blocks are kept
// in the order their first part arrived; parallel blocks interleaving on the wire stay separate.
export let createCollector = () => {
  let content: CollectedPart[] = [];
  let open = new Map<string, Extract<CollectedPart, { type: 'text' | 'reasoning' }>>();

  let result: CollectedResponse = {
    content,
    finishReason: { unified: 'other', raw: undefined },
    usage: emptyUsage(),
    finished: false,
    warnings: []
  };

  let block = (kind: 'text' | 'reasoning', id: string) => {
    let key = `${kind}:${id}`;
    let existing = open.get(key);
    if (existing) return existing;

    let created = { type: kind, text: '' } as Extract<
      CollectedPart,
      { type: 'text' | 'reasoning' }
    >;
    open.set(key, created);
    content.push(created);

    return created;
  };

  let annotate = (
    target: { providerMetadata?: SharedV4ProviderMetadata },
    metadata: SharedV4ProviderMetadata | undefined
  ) => {
    target.providerMetadata = mergeProviderMetadata(target.providerMetadata, metadata);
  };

  let push = (part: LanguageModelV4StreamPart) => {
    switch (part.type) {
      case 'stream-start':
        result.warnings.push(...part.warnings);
        return;

      case 'response-metadata':
        result.responseId ??= part.id;
        result.modelId ??= part.modelId;
        return;

      case 'text-start':
      case 'reasoning-start':
        annotate(
          block(part.type == 'text-start' ? 'text' : 'reasoning', part.id),
          part.providerMetadata
        );
        return;

      case 'text-delta':
      case 'reasoning-delta': {
        let target = block(part.type == 'text-delta' ? 'text' : 'reasoning', part.id);
        target.text += part.delta;
        annotate(target, part.providerMetadata);
        return;
      }

      case 'text-end':
      case 'reasoning-end': {
        let kind: 'text' | 'reasoning' = part.type == 'text-end' ? 'text' : 'reasoning';
        annotate(block(kind, part.id), part.providerMetadata);
        open.delete(`${kind}:${part.id}`);
        return;
      }

      case 'tool-call': {
        if (part.providerExecuted) return;

        let call: CollectedPart = {
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
          providerMetadata: part.providerMetadata
        };

        let existing = content.findIndex(
          entry => entry.type == 'tool-call' && entry.toolCallId == part.toolCallId
        );
        if (existing >= 0) content[existing] = call;
        else content.push(call);
        return;
      }

      case 'finish':
        result.finishReason = part.finishReason;
        result.usage = usageFromPart(part);
        result.providerMetadata = part.providerMetadata;
        result.finished = true;
        return;
    }
  };

  return { push, result: () => result };
};
