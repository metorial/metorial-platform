import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import {
  createCollector,
  decodeProviderMetadata,
  dialectAdapters,
  encodeProviderMetadata,
  type Dialect
} from '../src';
import { parseError } from './harness';
import {
  anthropicSignatureFor,
  openaiEncryptedContentFor,
  reasoningOptionsFromSignature
} from '../src/lib/envelope';
import { serializeSseEvent } from '../src/lib/sse';

let finish: LanguageModelV4StreamPart = {
  type: 'finish',
  finishReason: { unified: 'stop', raw: 'end_turn' },
  usage: {
    inputTokens: { total: 10, noCache: undefined, cacheRead: 4, cacheWrite: undefined },
    outputTokens: { total: 6, text: undefined, reasoning: 2 }
  },
  providerMetadata: { anthropic: { stopSequence: null } }
};

let collect = (parts: LanguageModelV4StreamPart[]) => {
  let collector = createCollector();
  parts.forEach(part => collector.push(part));
  return collector.result();
};

describe('collector', () => {
  it('folds deltas into blocks in the order they started, even when interleaved', () => {
    let result = collect([
      { type: 'stream-start', warnings: [{ type: 'unsupported', feature: 'topK' }] },
      { type: 'response-metadata', id: 'resp_1', modelId: 'm-1' },
      { type: 'reasoning-start', id: 'r', providerMetadata: { openai: { itemId: 'rs_1' } } },
      { type: 'text-start', id: 't' },
      { type: 'reasoning-delta', id: 'r', delta: 'Think ' },
      { type: 'text-delta', id: 't', delta: 'Hel' },
      { type: 'reasoning-delta', id: 'r', delta: 'more' },
      { type: 'text-delta', id: 't', delta: 'lo' },
      {
        type: 'reasoning-end',
        id: 'r',
        providerMetadata: { openai: { reasoningEncryptedContent: 'enc' } }
      },
      { type: 'text-end', id: 't' },
      finish
    ]);

    expect(result).toEqual({
      responseId: 'resp_1',
      modelId: 'm-1',
      content: [
        {
          type: 'reasoning',
          text: 'Think more',
          providerMetadata: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc' } }
        },
        { type: 'text', text: 'Hello' }
      ],
      finishReason: { unified: 'stop', raw: 'end_turn' },
      usage: {
        input: { total: 10, noCache: 6, cacheRead: 4, cacheWrite: 0 },
        output: { total: 6, text: 4, reasoning: 2 }
      },
      finished: true,
      providerMetadata: { anthropic: { stopSequence: null } },
      warnings: [{ type: 'unsupported', feature: 'topK' }]
    });
  });

  it('starts a new block when an id is reused after its block ended', () => {
    let result = collect([
      { type: 'text-start', id: '0' },
      { type: 'text-delta', id: '0', delta: 'a' },
      { type: 'text-end', id: '0' },
      { type: 'text-start', id: '0' },
      { type: 'text-delta', id: '0', delta: 'b' },
      { type: 'text-end', id: '0' }
    ]);

    expect(result.content).toEqual([
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' }
    ]);
    expect(result.finished).toBe(false);
  });

  it('keeps the final tool call input and skips provider-executed calls', () => {
    let result = collect([
      { type: 'tool-input-start', id: 'c1', toolName: 'f' },
      { type: 'tool-input-delta', id: 'c1', delta: '{"a":' },
      { type: 'tool-call', toolCallId: 'c1', toolName: 'f', input: '{"a":1}' },
      {
        type: 'tool-call',
        toolCallId: 'c1',
        toolName: 'f',
        input: '{"a":2}',
        providerMetadata: { x: { y: 1 } }
      },
      {
        type: 'tool-call',
        toolCallId: 'srv',
        toolName: 'web_search',
        input: '{}',
        providerExecuted: true
      },
      finish
    ]);

    expect(result.content).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'c1',
        toolName: 'f',
        input: '{"a":2}',
        providerMetadata: { x: { y: 1 } }
      }
    ]);
  });
});

describe('provider metadata envelope', () => {
  it('round-trips arbitrary metadata, including unicode', () => {
    let metadata = {
      google: { thoughtSignature: 'sig' },
      custom: { nested: { list: [1, 'ü', null] } }
    };
    let encoded = encodeProviderMetadata(metadata)!;

    expect(encoded.startsWith('mgw1.')).toBe(true);
    expect(encoded).toMatch(/^mgw1\.[A-Za-z0-9_-]+$/);
    expect(decodeProviderMetadata(encoded)).toEqual(metadata);
  });

  it('encodes nothing for empty metadata', () => {
    expect(encodeProviderMetadata(undefined)).toBeUndefined();
    expect(encodeProviderMetadata({})).toBeUndefined();
    expect(encodeProviderMetadata({ anthropic: {} })).toBeUndefined();
  });

  it('does not decode vendor blobs or corrupted envelopes', () => {
    expect(decodeProviderMetadata('EqQBCkYIBRgCKkB+abc==')).toBeNull();
    expect(decodeProviderMetadata('mgw1.not-json')).toBeNull();
    expect(
      decodeProviderMetadata(`mgw1.${Buffer.from('[1,2]').toString('base64url')}`)
    ).toBeNull();
  });

  it('keeps native Anthropic signatures and OpenAI encrypted content native', () => {
    expect(anthropicSignatureFor({ anthropic: { signature: 'native' } })).toBe('native');
    expect(anthropicSignatureFor(undefined)).toBe('');
    expect(anthropicSignatureFor({ anthropic: { signature: 'native', extra: 1 } })).toMatch(
      /^mgw1\./
    );

    expect(
      openaiEncryptedContentFor({ openai: { itemId: 'rs', reasoningEncryptedContent: 'enc' } })
    ).toBe('enc');
    expect(
      openaiEncryptedContentFor({ azure: { itemId: 'rs', reasoningEncryptedContent: 'enc' } })
    ).toBe('enc');
    expect(openaiEncryptedContentFor({ openai: { itemId: 'rs' } })).toMatch(/^mgw1\./);
    expect(openaiEncryptedContentFor(undefined)).toBeNull();
  });

  it('prefers the envelope over the native interpretation when reading a signature back', () => {
    let native = (value: string) => ({ anthropic: { signature: value } });

    expect(reasoningOptionsFromSignature('vendor', native)).toEqual({
      anthropic: { signature: 'vendor' }
    });
    expect(
      reasoningOptionsFromSignature(encodeProviderMetadata({ x: { y: 1 } }), native)
    ).toEqual({ x: { y: 1 } });
    expect(reasoningOptionsFromSignature('', native)).toBeUndefined();
    expect(reasoningOptionsFromSignature(null, native)).toBeUndefined();
  });
});

describe('sse serialization', () => {
  it('writes named and unnamed events', () => {
    expect(serializeSseEvent({ event: 'message_stop', data: '{"type":"message_stop"}' })).toBe(
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    );
    expect(serializeSseEvent({ data: '[DONE]' })).toBe('data: [DONE]\n\n');
  });
});

describe('model', () => {
  let minimal: Record<Dialect, Record<string, unknown>> = {
    openai_chat: { messages: [{ role: 'user', content: 'hi' }] },
    anthropic_messages: { max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] },
    open_responses: { input: 'hi' }
  };

  for (let dialect of Object.keys(minimal) as Dialect[]) {
    it(`is required by ${dialect}`, () => {
      expect(parseError(dialect, minimal[dialect])).toMatchObject({
        param: 'model',
        message: 'The "model" field is required.'
      });
      expect(parseError(dialect, { ...minimal[dialect], model: '  ' })).toMatchObject({
        param: 'model'
      });
      expect(parseError(dialect, { ...minimal[dialect], model: 4 })).toMatchObject({
        param: 'model'
      });
    });

    it(`is trimmed by ${dialect}`, () => {
      expect(
        dialectAdapters[dialect].parseRequest({ ...minimal[dialect], model: ' openai/gpt-5 ' })
          .model
      ).toBe('openai/gpt-5');
    });
  }
});
