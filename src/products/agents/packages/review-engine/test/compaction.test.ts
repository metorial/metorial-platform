import type { ModelMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { compactMessages } from '../src';

let big = 'x'.repeat(5000);

let toolStep = (
  id: string,
  value: string,
  type: 'text' | 'error-text' = 'text'
): ModelMessage[] => [
  {
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'thinking '.repeat(200) },
      { type: 'tool-call', toolCallId: id, toolName: 'bash', input: { command: `cat ${id}` } }
    ]
  },
  {
    role: 'tool',
    content: [
      { type: 'tool-result', toolCallId: id, toolName: 'bash', output: { type, value } }
    ]
  }
];

let history = (steps: number): ModelMessage[] => [
  { role: 'user', content: 'Review this.' },
  ...Array.from({ length: steps }, (_, i) => toolStep(`call-${i}`, big)).flat()
];

let outputs = (messages: ModelMessage[]) =>
  messages.flatMap(message =>
    message.role == 'tool'
      ? message.content.map(part =>
          part.type == 'tool-result' && 'value' in part.output ? part.output.value : null
        )
      : []
  );

let isOmitted = (value: unknown) =>
  typeof value == 'string' && value.startsWith('[Output omitted');

describe('compactMessages', () => {
  it('leaves the history alone below the trigger', () => {
    let messages = history(10);
    let result = compactMessages({
      messages,
      lastInputTokens: 50_000,
      contextWindow: 128_000
    });

    expect(result.compacted).toBe(false);
    expect(result.messages).toBe(messages);
  });

  it('never compacts models with an unknown window', () => {
    expect(
      compactMessages({
        messages: history(10),
        lastInputTokens: 1_000_000,
        contextWindow: undefined
      }).compacted
    ).toBe(false);
  });

  it('stubs older tool results but keeps the latest ones when that is enough', () => {
    let messages = history(12);
    let result = compactMessages({
      messages,
      lastInputTokens: 90_000,
      contextWindow: 128_000
    });

    let values = outputs(result.messages);
    expect(result.compacted).toBe(true);
    expect(values.slice(0, 6).every(isOmitted)).toBe(true);
    expect(values.slice(-6)).toEqual(Array(6).fill(big));
  });

  it('keeps every tool call paired with its result', () => {
    let result = compactMessages({
      messages: history(12),
      lastInputTokens: 90_000,
      contextWindow: 128_000
    });

    let calls = result.messages.flatMap(message =>
      message.role == 'assistant' && Array.isArray(message.content)
        ? message.content.flatMap(part => (part.type == 'tool-call' ? [part.toolCallId] : []))
        : []
    );
    let results = result.messages.flatMap(message =>
      message.role == 'tool'
        ? message.content.flatMap(part =>
            part.type == 'tool-result' ? [part.toolCallId] : []
          )
        : []
    );

    expect(results).toEqual(calls);
    expect(result.messages).toHaveLength(history(12).length);
  });

  it('drops reasoning from earlier steps', () => {
    let result = compactMessages({
      messages: history(3),
      lastInputTokens: 90_000,
      contextWindow: 128_000
    });

    let reasoning = result.messages.flatMap(message =>
      message.role == 'assistant' && Array.isArray(message.content)
        ? message.content.filter(part => part.type == 'reasoning')
        : []
    );
    expect(reasoning).toHaveLength(0);
  });

  it('keeps the two latest results when that is enough', () => {
    let values = outputs(
      compactMessages({
        messages: history(6),
        lastInputTokens: 120_000,
        contextWindow: 128_000
      }).messages
    );

    expect(values.slice(0, 4).every(isOmitted)).toBe(true);
    expect(values.slice(-2)).toEqual([big, big]);
  });

  it('keeps shrinking recent results when the older ones are not enough', () => {
    let huge = 'x'.repeat(100_000);
    let messages: ModelMessage[] = [
      { role: 'user', content: 'Review this.' },
      ...['a', 'b', 'c'].flatMap(id => toolStep(id, huge))
    ];

    let result = compactMessages({
      messages,
      lastInputTokens: 100_000,
      contextWindow: 128_000
    });

    expect(outputs(result.messages).every(isOmitted)).toBe(true);
  });

  it('keeps short results and errors', () => {
    let messages: ModelMessage[] = [
      { role: 'user', content: 'Review this.' },
      ...toolStep('short', 'ok'),
      ...toolStep('error', big, 'error-text'),
      ...history(10).slice(1)
    ];

    let values = outputs(
      compactMessages({ messages, lastInputTokens: 90_000, contextWindow: 128_000 }).messages
    );

    expect(values[0]).toBe('ok');
    expect(values[1]).toBe(big);
  });

  it('is stable when applied twice', () => {
    let once = compactMessages({
      messages: history(12),
      lastInputTokens: 90_000,
      contextWindow: 128_000
    });
    let twice = compactMessages({
      messages: once.messages,
      lastInputTokens: 20_000,
      contextWindow: 128_000
    });

    expect(JSON.stringify(twice.messages)).toBe(JSON.stringify(once.messages));
  });
});
