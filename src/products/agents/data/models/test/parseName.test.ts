import { describe, expect, it } from 'vitest';
import { extractTrailingDate, normalizeKey, parseName } from '../src/normalize/parseName';
import { resolveOrg } from './helpers';

describe('parseName', () => {
  it('unwraps Bedrock inference profile ids', () => {
    let parsed = parseName('us.anthropic.claude-sonnet-4-5-20250929-v1:0', { resolveOrg });

    expect(parsed.labHint).toBe('anthropic');
    expect(parsed.region).toBe('us');
    expect(parsed.revision).toBe('v1:0');
    expect(parsed.date).toBe('2025-09-29');
    expect(parsed.stem).toBe('claude-sonnet-4-5');
    expect(parsed.wrapper).toBe('bedrock');
  });

  it('reads Vertex @date snapshots', () => {
    let parsed = parseName('claude-sonnet-4-5@20250929', { resolveOrg });

    expect(parsed.date).toBe('2025-09-29');
    expect(parsed.stem).toBe('claude-sonnet-4-5');
  });

  it('takes the lab hint from a namespace', () => {
    let parsed = parseName('anthropic/claude-opus-4.5', { resolveOrg });

    expect(parsed.labHint).toBe('anthropic');
    expect(parsed.slug).toBe('claude-opus-4.5');
    expect(parsed.stem).toBe('claude-opus-4-5');
  });

  it('separates variant tags from the model', () => {
    let parsed = parseName('meta-llama/llama-3.3-70b-instruct:free', { resolveOrg });

    expect(parsed.variant.free).toBe(true);
    expect(parsed.labHint).toBe('meta');
    expect(parsed.slug).toBe('llama-3.3-70b-instruct');
  });

  it('detects latest pointers and numbered revisions', () => {
    expect(parseName('claude-3-5-haiku-latest').isLatest).toBe(true);
    expect(parseName('gemini-2.0-flash-001')).toMatchObject({
      revision: '001',
      slug: 'gemini-2.0-flash'
    });
  });

  it('keeps the date when asked to', () => {
    let parsed = parseName('gpt-4o-2024-08-06', { stripDate: false });

    expect(parsed.date).toBeNull();
    expect(parsed.slug).toBe('gpt-4o-2024-08-06');
  });

  it('normalizes keys and trailing dates', () => {
    expect(normalizeKey('Claude Opus 4.5')).toBe('claude-opus-4-5');
    expect(extractTrailingDate('claude-opus-4-5-20251101')).toMatchObject({
      stem: 'claude-opus-4-5',
      date: '2025-11-01',
      precision: 'day'
    });
  });
});
