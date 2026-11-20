import { summarizeRequest } from '@mtsrc/ai-gateway-request-features';
import { describe, expect, it } from 'vitest';
import { orderTargets, type TargetProfile } from '../src/lib/targets';

let profile = (overrides: Partial<TargetProfile> = {}): TargetProfile => ({
  modelSlug: 'm',
  contextTokens: 200_000,
  inputModalities: ['text', 'image'],
  supportsTools: true,
  ...overrides
});

let profiles = new Map<string, TargetProfile>([
  ['vision', profile()],
  ['text-only', profile({ inputModalities: ['text'] })],
  ['tiny', profile({ contextTokens: 10 })],
  ['no-tools', profile({ supportsTools: false })]
]);

let summary = (body: unknown) => summarizeRequest('openai_chat', body);

describe('orderTargets', () => {
  it('skips models that cannot handle the request', () => {
    let result = orderTargets({
      targets: [
        { model: 'text-only' },
        { model: 'tiny' },
        { model: 'vision' },
        { model: 'gone' }
      ],
      profiles,
      random: () => 0.5,
      summary: summary({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'describe this image in a lot of detail please' },
              { type: 'image_url', image_url: { url: 'https://x/y.png' } }
            ]
          }
        ]
      })
    });

    expect(result.ordered.map(target => target.model)).toEqual(['vision']);
    expect(result.skipped).toEqual([
      { model: 'text-only', reason: 'image_input' },
      { model: 'tiny', reason: 'context_window' },
      { model: 'gone', reason: 'unknown_model' }
    ]);
  });

  it('skips models without tool support when tools are sent', () => {
    let result = orderTargets({
      targets: [{ model: 'no-tools' }, { model: 'vision' }],
      profiles,
      random: () => 0.5,
      summary: summary({
        messages: [{ role: 'user', content: 'hi' }],
        tools: [{ type: 'function', function: { name: 'bash' } }]
      })
    });

    expect(result.ordered.map(target => target.model)).toEqual(['vision']);
  });

  it('orders by weight and keeps the rest as fallbacks', () => {
    let draws = [0.9, 0.1];
    let result = orderTargets({
      targets: [
        { model: 'text-only', weight: 1 },
        { model: 'vision', weight: 1000 }
      ],
      profiles,
      random: () => draws.shift()!,
      summary: summary({ messages: [{ role: 'user', content: 'hi' }] })
    });

    expect(result.ordered.map(target => target.model)).toEqual(['vision', 'text-only']);
  });
});
