import { describe, expect, it } from 'vitest';
import type { ContentPolicy } from '@metorial/groundstation-spec';
import { buildContentEntry, maxFullTextBytes } from '../engine';
import { contentHash } from '../../crypto/keys';
import { unitOrganizationKey, unitPrincipal } from '../../test/build';

let organizationKey = unitOrganizationKey();

let entry = (
  defaultMode: ContentPolicy['defaultMode'],
  input: Parameters<typeof buildContentEntry>[1],
  roles?: ContentPolicy['roles'],
  markers?: string[]
) =>
  buildContentEntry(
    { policy: { defaultMode, roles }, organizationKey, redactionMarkers: markers },
    input
  );

describe('buildContentEntry basic mode', () => {
  it('stores length and keyed hash only', () => {
    let result = entry('basic', { role: 'prompt', value: 'héllo wörld' });

    expect(result).toEqual({
      role: 'prompt',
      mode: 'basic',
      state: 'present',
      length: { chars: 11, bytes: 13, source: 'measured' },
      hash: {
        alg: 'hmac-sha256-128',
        value: contentHash(organizationKey, 'prompt', 'héllo wörld'),
        basis: 'full'
      }
    });
  });

  it('never carries shape or text', () => {
    let result = entry('basic', { role: 'tool_input', value: { command: 'ls' } })!;

    expect(result).not.toHaveProperty('shape');
    expect(result).not.toHaveProperty('text');
  });

  it('hashes JSON for object values', () => {
    let result = entry('basic', { role: 'tool_input', value: { a: 1 } })!;

    expect(result.hash?.value).toBe(contentHash(organizationKey, 'tool_input', '{"a":1}'));
    expect(result.length?.chars).toBe(7);
  });

  it('stringifies numbers and booleans', () => {
    expect(entry('basic', { role: 'response', value: 42 })?.length?.chars).toBe(2);
    expect(entry('basic', { role: 'response', value: false })?.length?.chars).toBe(5);
  });

  it('produces different hashes per role and per organization', () => {
    let a = entry('basic', { role: 'prompt', value: 'x' })!;
    let b = entry('basic', { role: 'response', value: 'x' })!;
    let otherPrincipal = unitPrincipal({ organization: { id: 'gor_other' } });

    let other = buildContentEntry(
      {
        policy: { defaultMode: 'basic' },
        organizationKey: unitOrganizationKey(otherPrincipal)
      },
      { role: 'prompt', value: 'x' }
    )!;

    expect(a.hash?.value).not.toBe(b.hash?.value);
    expect(a.hash?.value).not.toBe(other.hash?.value);
  });
});

describe('buildContentEntry absent values', () => {
  it('returns null without a value or length', () => {
    expect(entry('full', { role: 'prompt' })).toBeNull();
    expect(entry('full', { role: 'prompt', value: '' })).toBeNull();
    expect(entry('full', { role: 'prompt', value: null })).toBeNull();
    expect(entry('full', { role: 'prompt', value: undefined })).toBeNull();
  });

  it('records a client-reported length when the value is missing', () => {
    expect(entry('full', { role: 'prompt', clientLength: 120 })).toEqual({
      role: 'prompt',
      mode: 'full',
      state: 'length_only',
      length: { chars: 120, source: 'client_reported' }
    });
  });

  it('also does so for an empty string value', () => {
    expect(entry('basic', { role: 'prompt', value: '', clientLength: 5 })?.state).toBe(
      'length_only'
    );
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2])(
    'ignores the unusable client length %s',
    clientLength => {
      expect(entry('basic', { role: 'prompt', clientLength })).toBeNull();
    }
  );

  it('returns null for values that cannot be serialized', () => {
    let cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;

    expect(entry('full', { role: 'tool_input', value: cyclic })).toBeNull();
    expect(entry('full', { role: 'tool_input', value: () => 1 })).toBeNull();
    expect(entry('full', { role: 'tool_input', value: Symbol('s') })).toBeNull();
  });
});

describe('buildContentEntry redaction', () => {
  it('records a redaction marker without length or hash', () => {
    expect(entry('full', { role: 'prompt', value: '[REDACTED]' })).toEqual({
      role: 'prompt',
      mode: 'full',
      state: 'redacted_by_client'
    });
  });

  it('supports custom markers', () => {
    expect(
      entry('basic', { role: 'prompt', value: '<hidden>' }, undefined, ['<hidden>'])?.state
    ).toBe('redacted_by_client');
    expect(
      entry('basic', { role: 'prompt', value: '[REDACTED]' }, undefined, ['<hidden>'])?.state
    ).toBe('present');
  });

  it('only matches whole-string markers', () => {
    expect(entry('basic', { role: 'prompt', value: 'a [REDACTED] b' })?.state).toBe('present');
    expect(entry('basic', { role: 'prompt', value: ['[REDACTED]'] })?.state).toBe('present');
  });
});

describe('buildContentEntry shape mode', () => {
  it('adds a shape without text', () => {
    let result = entry('shape', { role: 'prompt', value: 'a\nb' })!;

    expect(result.mode).toBe('shape');
    expect(result.shape).toEqual({ v: 1, lines: 2, code_blocks: 0, urls: 0 });
    expect(result).not.toHaveProperty('text');
  });

  it('defaults tool input hints to the value', () => {
    let result = entry('shape', {
      role: 'tool_input',
      value: { command: 'git push --force' },
      hints: { tool: 'Bash' }
    })!;

    expect(result.shape).toMatchObject({ programs: ['git'], flags: ['--force'] });
  });

  it('prefers explicit tool input hints', () => {
    let result = entry('shape', {
      role: 'tool_input',
      value: { command: 'ignored' },
      hints: { tool: 'Bash', input: { command: 'rm -rf x' } }
    })!;

    expect(result.shape).toMatchObject({ programs: ['rm'] });
  });

  it('omits the shape for roles without one', () => {
    expect(entry('shape', { role: 'system_prompt', value: 'x' })).not.toHaveProperty('shape');
  });
});

describe('buildContentEntry full mode', () => {
  it('stores the text', () => {
    let result = entry('full', { role: 'response', value: 'hello' })!;

    expect(result.text).toBe('hello');
    expect(result.mode).toBe('full');
    expect(result.shape).toBeDefined();
    expect(result).not.toHaveProperty('truncated');
  });

  it('downgrades system prompts and raw payloads to shape', () => {
    for (let role of ['system_prompt', 'raw_request', 'raw_response'] as const) {
      let result = entry('full', { role, value: 'sensitive' })!;

      expect(result.mode).toBe('shape');
      expect(result).not.toHaveProperty('text');
    }
  });

  it('allows an explicit full override for raw payloads', () => {
    let result = entry('basic', { role: 'raw_request', value: 'x' }, { raw_request: 'full' })!;

    expect(result.text).toBe('x');
  });

  it('keeps text at exactly the byte limit', () => {
    let text = 'a'.repeat(maxFullTextBytes);
    let result = entry('full', { role: 'response', value: text })!;

    expect(result.text).toBe(text);
    expect(result.truncated).toBeUndefined();
  });

  it('truncates just above the byte limit but hashes the whole value', () => {
    let text = 'a'.repeat(maxFullTextBytes + 1);
    let result = entry('full', { role: 'response', value: text })!;

    expect(result.text).toHaveLength(maxFullTextBytes);
    expect(result.truncated).toBe(true);
    expect(result.original_length).toBe(maxFullTextBytes + 1);
    expect(result.length).toEqual({
      chars: maxFullTextBytes + 1,
      bytes: maxFullTextBytes + 1,
      source: 'measured'
    });
    expect(result.hash?.value).toBe(contentHash(organizationKey, 'response', text));
    expect(result.hash?.basis).toBe('full');
  });

  it('truncates multibyte text on a character boundary', () => {
    let text = 'é'.repeat(maxFullTextBytes);
    let result = entry('full', { role: 'response', value: text })!;

    expect(Buffer.byteLength(result.text!)).toBeLessThanOrEqual(maxFullTextBytes);
    expect(result.text).toBe('é'.repeat(maxFullTextBytes / 2));
  });

  it('never splits a surrogate pair when truncating', () => {
    let text = 'a' + '😀'.repeat(maxFullTextBytes);
    let result = entry('full', { role: 'response', value: text })!;

    let stored = result.text!;

    expect(Buffer.byteLength(stored)).toBeLessThanOrEqual(maxFullTextBytes);
    expect(Buffer.from(stored).toString()).toBe(stored);
    expect(stored.charCodeAt(stored.length - 1)).toBeGreaterThanOrEqual(0xdc00);
    expect(stored).toBe('a' + '😀'.repeat(16383));
  });

  it('applies per-role overrides', () => {
    let roles: ContentPolicy['roles'] = { tool_output: 'basic', prompt: 'full' };

    expect(entry('shape', { role: 'tool_output', value: 'x' }, roles)?.mode).toBe('basic');
    expect(entry('shape', { role: 'prompt', value: 'x' }, roles)?.text).toBe('x');
    expect(entry('shape', { role: 'response', value: 'x' }, roles)?.text).toBeUndefined();
  });
});

describe('buildContentEntry client truncation', () => {
  it('reports the original length and a truncated hash basis', () => {
    let result = entry('basic', {
      role: 'tool_output',
      value: 'abc',
      clientTruncated: { originalLength: 9000 }
    })!;

    expect(result.length).toEqual({ chars: 9000, bytes: 3, source: 'client_reported' });
    expect(result.hash?.basis).toBe('truncated');
    expect(result).not.toHaveProperty('truncated');
  });

  it('marks full-mode text as truncated with the original length', () => {
    let result = entry('full', {
      role: 'tool_output',
      value: 'abc',
      clientTruncated: { originalLength: 9000 }
    })!;

    expect(result.text).toBe('abc');
    expect(result.truncated).toBe(true);
    expect(result.original_length).toBe(9000);
  });
});
