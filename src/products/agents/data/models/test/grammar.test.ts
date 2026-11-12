import { describe, expect, it } from 'vitest';
import { familyDisplayName, parseModelSlug } from '../src/normalize/grammar';

let shape = (slug: string, labId: string) => {
  let parsed = parseModelSlug(slug, labId);
  return { series: parsed.series, version: parsed.version, size: parsed.size?.label ?? null };
};

describe('parseModelSlug', () => {
  it.each([
    ['claude-opus-4.5', 'anthropic', { series: 'claude-opus', version: '4.5', size: null }],
    ['claude-3.5-haiku', 'anthropic', { series: 'claude-haiku', version: '3.5', size: null }],
    ['claude-4-sonnet', 'anthropic', { series: 'claude-sonnet', version: '4', size: null }],
    ['gpt-6-sol', 'openai', { series: 'gpt-sol', version: '6', size: null }],
    ['gpt-4o-mini', 'openai', { series: 'gpt-mini', version: '4o', size: null }],
    ['o3-mini', 'openai', { series: 'o-mini', version: '3', size: null }],
    [
      'gemini-2.5-flash-lite',
      'google',
      { series: 'gemini-flash-lite', version: '2.5', size: null }
    ],
    ['deepseek-r1', 'deepseek', { series: 'deepseek-r', version: '1', size: null }],
    [
      'qwen3-235b-a22b-instruct-2507',
      'alibaba',
      { series: 'qwen', version: '3', size: '235b-a22b' }
    ],
    [
      'llama-4-maverick-17b-instruct',
      'meta',
      { series: 'llama-maverick', version: '4', size: '17b' }
    ],
    ['glm-4.5v', 'zhipu', { series: 'glm-v', version: '4.5', size: null }]
  ])('%s (%s)', (slug, labId, expected) => {
    expect(shape(slug, labId)).toEqual(expected);
  });

  it('keeps modifiers out of the series', () => {
    expect(parseModelSlug('qwen3-235b-a22b-instruct-2507', 'alibaba').modifiers).toEqual([
      'instruct'
    ]);
  });

  it('names families', () => {
    expect(familyDisplayName('claude-opus', 'anthropic')).toBe('Claude Opus');
    expect(familyDisplayName('gpt-sol', 'openai')).toBe('GPT Sol');
    expect(familyDisplayName('deepseek-r', 'deepseek')).toBe('DeepSeek R');
  });
});
