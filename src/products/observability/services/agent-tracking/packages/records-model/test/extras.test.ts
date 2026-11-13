import { describe, expect, it } from 'vitest';
import {
  isContentKey,
  maxExtraKeys,
  maxExtraValueBytes,
  normalizeExtraKey,
  sanitizeExtraValue,
  sanitizeExtras
} from '../src/extras';

describe('normalizeExtraKey', () => {
  it('lowercases and replaces unsafe characters', () => {
    expect(normalizeExtraKey('Plan Type')).toBe('plan_type');
    expect(normalizeExtraKey('a/b')).toBe('a_b');
  });

  it('rejects keys that cannot start a slug', () => {
    expect(normalizeExtraKey('_x')).toBeNull();
    expect(normalizeExtraKey('')).toBeNull();
    expect(normalizeExtraKey('-x')).toBeNull();
  });

  it('clips long keys', () => {
    expect(normalizeExtraKey('a'.repeat(200))).toHaveLength(64);
  });
});

describe('isContentKey', () => {
  it.each([
    'prompt',
    'user_prompt',
    'toolInput',
    'file_path',
    'Authorization',
    'api_key',
    'user.email',
    'error_message',
    'command_line',
    'thoughts'
  ])('flags %s', key => {
    expect(isContentKey(key)).toBe(true);
  });

  it.each(['plan', 'tier', 'speed', 'region', 'terminal_type', 'flag_a'])('allows %s', key => {
    expect(isContentKey(key)).toBe(false);
  });
});

describe('sanitizeExtraValue', () => {
  it('passes primitives', () => {
    expect(sanitizeExtraValue('x')).toBe('x');
    expect(sanitizeExtraValue(3)).toBe(3);
    expect(sanitizeExtraValue(false)).toBe(false);
  });

  it('drops non-finite numbers, null and undefined', () => {
    expect(sanitizeExtraValue(NaN)).toBeNull();
    expect(sanitizeExtraValue(Infinity)).toBeNull();
    expect(sanitizeExtraValue(null)).toBeNull();
    expect(sanitizeExtraValue(undefined)).toBeNull();
    expect(sanitizeExtraValue(10n)).toBeNull();
  });

  it('serializes objects and arrays', () => {
    expect(sanitizeExtraValue({ a: 1 })).toBe('{"a":1}');
    expect(sanitizeExtraValue([1, 2])).toBe('[1,2]');
  });

  it('drops values that cannot be serialized', () => {
    let cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;

    expect(sanitizeExtraValue(cyclic)).toBeNull();
    expect(sanitizeExtraValue({ toJSON: () => undefined })).toBeNull();
  });

  it('clamps strings to the byte limit without splitting characters', () => {
    let clamped = sanitizeExtraValue('é'.repeat(500)) as string;

    expect(Buffer.byteLength(clamped)).toBeLessThanOrEqual(maxExtraValueBytes);
    expect(clamped).toBe('é'.repeat(128));
  });

  it('does not leave a lone surrogate when clamping', () => {
    let clamped = sanitizeExtraValue('😀'.repeat(200)) as string;

    expect(Buffer.byteLength(clamped)).toBeLessThanOrEqual(maxExtraValueBytes);
    expect(Buffer.from(clamped).toString()).toBe(clamped);
    expect(clamped).not.toMatch(/[\ud800-\udbff]$/);
  });
});

describe('sanitizeExtras', () => {
  it('returns empty results without input', () => {
    expect(sanitizeExtras('codex', undefined)).toEqual({ extras: {}, dropped: [] });
  });

  it('namespaces allowed keys under the client', () => {
    let { extras, dropped } = sanitizeExtras('claude-code', {
      plan: 'max',
      Speed: 'fast',
      n: 2
    });

    expect(extras).toEqual({
      'x.claude-code.plan': 'max',
      'x.claude-code.speed': 'fast',
      'x.claude-code.n': 2
    });
    expect(dropped).toEqual([]);
  });

  it('drops content-like keys without echoing their names', () => {
    let { extras, dropped } = sanitizeExtras('codex', {
      user_prompt: 'secret',
      api_token: 'abc',
      plan: 'x'
    });

    expect(Object.keys(extras)).toEqual(['x.codex.plan']);
    expect(dropped).toEqual(['extras.content_key', 'extras.content_key']);
    expect(JSON.stringify({ extras, dropped })).not.toContain('secret');
  });

  it('drops unusable keys and values', () => {
    let { extras, dropped } = sanitizeExtras('codex', { '': 'a', ok: null, good: 'b' });

    expect(extras).toEqual({ 'x.codex.good': 'b' });
    expect(dropped).toContain('extras.content_key');
    expect(dropped).toContain('extras.ok');
  });

  it('caps the number of keys', () => {
    let raw: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) raw[`k${i}`] = i;

    let { extras, dropped } = sanitizeExtras('c', raw);

    expect(Object.keys(extras)).toHaveLength(maxExtraKeys);
    expect(dropped).toEqual(['extras.overflow']);
  });

  it('is not fooled by prototype keys', () => {
    let raw = JSON.parse('{"__proto__": "x", "constructor": "y", "ok": 1}');

    let { extras } = sanitizeExtras('c', raw);

    expect(extras).toEqual({ 'x.c.constructor': 'y', 'x.c.ok': 1 });
    expect(Object.getPrototypeOf(extras)).toBe(Object.prototype);
  });
});
