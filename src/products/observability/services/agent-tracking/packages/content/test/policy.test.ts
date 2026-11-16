import { describe, expect, it } from 'vitest';
import { resolveContentMode } from '../src/policy';

describe('resolveContentMode', () => {
  it('uses the default mode', () => {
    expect(resolveContentMode({ defaultMode: 'basic' }, 'prompt')).toBe('basic');
    expect(resolveContentMode({ defaultMode: 'shape' }, 'tool_output')).toBe('shape');
    expect(resolveContentMode({ defaultMode: 'full' }, 'response')).toBe('full');
  });

  it('prefers a role override', () => {
    let policy = { defaultMode: 'full' as const, roles: { prompt: 'basic' as const } };

    expect(resolveContentMode(policy, 'prompt')).toBe('basic');
    expect(resolveContentMode(policy, 'response')).toBe('full');
  });

  it('can raise a role above the default', () => {
    let policy = { defaultMode: 'basic' as const, roles: { diff: 'full' as const } };

    expect(resolveContentMode(policy, 'diff')).toBe('full');
    expect(resolveContentMode(policy, 'path')).toBe('basic');
  });

  it('never stores system prompts, raw payloads or paths in full mode by default', () => {
    for (let role of ['system_prompt', 'raw_request', 'raw_response', 'path'] as const) {
      expect(resolveContentMode({ defaultMode: 'full' }, role)).toBe('shape');
    }
  });

  it('allows an explicit override of the explicit-only roles', () => {
    let policy = { defaultMode: 'full' as const, roles: { raw_request: 'full' as const } };

    expect(resolveContentMode(policy, 'raw_request')).toBe('full');
  });

  it('does not lift explicit-only roles from lower defaults', () => {
    expect(resolveContentMode({ defaultMode: 'basic' }, 'system_prompt')).toBe('basic');
    expect(resolveContentMode({ defaultMode: 'shape' }, 'raw_response')).toBe('shape');
  });
});
