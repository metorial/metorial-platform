import type { CallOptions } from '@mtsrc/ai-gateway-dialects';
import { describe, expect, it } from 'vitest';
import { applyOverrides, cacheWriteTtlOf, promptStats } from '../src/lib/options';

let options: CallOptions = {
  prompt: [
    { role: 'system', content: 'Be brief.' },
    { role: 'user', content: [{ type: 'text', text: 'Hi' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] }
  ],
  maxOutputTokens: 1000,
  temperature: 1,
  reasoning: 'high'
};

describe('applyOverrides', () => {
  it('returns the options unchanged without overrides', () => {
    expect(applyOverrides(options, null)).toBe(options);
  });

  it('lets each override win over the caller', () => {
    expect(
      applyOverrides(options, {
        maxOutputTokens: 10,
        temperature: 0,
        reasoningEffort: 'minimal'
      })
    ).toMatchObject({ maxOutputTokens: 10, temperature: 0, reasoning: 'minimal' });
  });

  it('keeps caller values the overrides leave unset', () => {
    expect(applyOverrides(options, { temperature: 0.5 })).toMatchObject({
      maxOutputTokens: 1000,
      temperature: 0.5,
      reasoning: 'high'
    });
  });
});

describe('cacheWriteTtlOf', () => {
  it('defaults to five minutes', () => {
    expect(cacheWriteTtlOf(options)).toBe('5m');
  });

  it('finds one-hour breakpoints on messages, parts, tools and provider options', () => {
    let longCache = { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } };

    expect(
      cacheWriteTtlOf({
        ...options,
        prompt: [{ role: 'system', content: 'Long', providerOptions: longCache }]
      })
    ).toBe('1h');
    expect(
      cacheWriteTtlOf({
        ...options,
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Doc', providerOptions: longCache }]
          }
        ]
      })
    ).toBe('1h');
    expect(
      cacheWriteTtlOf({
        ...options,
        tools: [
          {
            type: 'function',
            name: 'x',
            inputSchema: { type: 'object' },
            providerOptions: longCache
          }
        ]
      })
    ).toBe('1h');
  });

  it('ignores five-minute breakpoints', () => {
    expect(
      cacheWriteTtlOf({
        ...options,
        prompt: [
          {
            role: 'system',
            content: 'Long',
            providerOptions: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '5m' } } }
          }
        ]
      })
    ).toBe('5m');
  });
});

describe('promptStats', () => {
  it('counts conversation messages and tools', () => {
    expect(
      promptStats({
        ...options,
        tools: [{ type: 'function', name: 'x', inputSchema: { type: 'object' } }]
      })
    ).toEqual({ messageCount: 2, toolCount: 1, maxOutputTokens: 1000 });
  });
});
